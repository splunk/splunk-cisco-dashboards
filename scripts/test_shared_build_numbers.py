"""Build numbering recovery, concurrent-service and terminal fallback tests.

All remote writes are simulated; no real build number is consumed.
"""

import concurrent.futures
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('reservation', ROOT / 'scripts/reserve_package_build.py')
r = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(r)


class SharedBuildTests(unittest.TestCase):
    def setUp(self):
        self.exec_env = os.environ.copy()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.receipts = self.root / 'dist/build-reservations'
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def service(self, initial=2171, workflow_state='disabled_manually', legacy=58):
        lock = threading.Lock()
        parent = 'a' * 40
        message = r.RECORD_PREFIX + json.dumps({'repository': r.REPOSITORY, 'build': initial, 'request_id': 'b' * 32})
        commits = {parent: {'message': message, 'tree': {'sha': 'c' * 40}, 'parents': []}}
        state = {'head': parent if initial is not None else None, 'writes': 0, 'calls': [], 'commits': commits}

        def api(method, endpoint, payload=None, **kwargs):
            with lock:
                state['calls'].append((method, endpoint, payload))
                if endpoint == '':
                    return {'full_name': r.REPOSITORY, 'default_branch': 'main', 'permissions': {'push': True}}
                if endpoint == 'git/ref/' + r.COUNTER_REF:
                    if state['head'] is None:
                        raise r.ApiError(404)
                    return {'object': {'sha': state['head']}}
                if endpoint == 'actions/workflows/' + r.WORKFLOW:
                    return {'id': 17, 'state': workflow_state}
                if endpoint.startswith('actions/workflows/'):
                    return {'total_count': 1, 'workflow_runs': [{'workflow_id': 17, 'run_number': legacy}]}
                if endpoint == 'git/ref/heads/main':
                    return {'object': {'sha': parent}}
                if method == 'GET' and endpoint.startswith('git/commits/'):
                    return commits[endpoint.split('/')[-1]]
                if endpoint == 'git/commits':
                    commit = f'{len(commits) + 10:040x}'
                    commits[commit] = {**payload, 'tree': {'sha': payload['tree']}}
                    return {'sha': commit}
                if endpoint in ('git/refs', 'git/refs/' + r.COUNTER_REF):
                    commit = payload['sha']
                    if method == 'POST' and state['head'] is not None:
                        raise r.ApiError(422)
                    if method == 'PATCH':
                        self.assertIs(payload['force'], False)
                        if commits[commit]['parents'] != [state['head']]:
                            raise r.ApiError(422)
                    state.update(head=commit, writes=state['writes'] + 1)
                    return {'object': {'sha': commit}}
                raise AssertionError((method, endpoint))
        return api, state

    def mocks(self, api):
        return patch.object(r, 'github', side_effect=api)

    def current(self, directory=None):
        return json.loads(((directory or self.receipts) / 'current.json').read_text())

    def reserve(self, api, floor=0, **kwargs):
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(api):
            return r.reserve_build(floor, self.receipts, **kwargs)

    def test_sequence_preserves_repository_identity_and_legacy_baseline(self):
        self.assertEqual(r.REPOSITORY, 'splunk/splunk-cisco-dashboards')
        self.assertEqual(r.OFFSET, 2113)
        api, state = self.service()
        self.assertEqual(self.reserve(api), 2172)
        self.assertEqual(self.current()['backend'], 'git-ref-v2')
        self.assertFalse(any('actions/' in e for _, e, _ in state['calls']))

    def test_concurrent_clients_reject_sibling_updates_and_reserve_distinct_numbers(self):
        api, state = self.service()
        barrier = threading.Barrier(2)
        def racing(method, endpoint, payload=None, **kwargs):
            if endpoint == 'git/commits' and payload['parents'] == ['a' * 40]:
                barrier.wait(timeout=5)
            return api(method, endpoint, payload)
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(racing):
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                numbers = list(pool.map(lambda i: r.reserve_build(0, self.root / str(i)), range(2)))
        self.assertEqual(sorted(numbers), [2172, 2173])
        self.assertEqual(state['writes'], 2)
        for i, n in enumerate(numbers):
            self.assertEqual(self.current(self.root / str(i))['build'], n)

    def test_concurrent_initializers_continue_one_legacy_sequence(self):
        api, state = self.service(initial=None)
        barrier = threading.Barrier(2)
        def racing(method, endpoint, payload=None, **kwargs):
            if endpoint == 'git/commits' and payload['parents'] == ['a' * 40]:
                barrier.wait(timeout=5)
            return api(method, endpoint, payload)
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(racing):
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                numbers = list(pool.map(lambda i: r.reserve_build(0, self.root / str(i), initialize=True), range(2)))
        self.assertEqual(sorted(numbers), [2172, 2173])
        self.assertEqual(state['writes'], 2)

    def test_explicit_initialization_continues_legacy_counter_and_local_floor(self):
        api, state = self.service(initial=None, legacy=100)
        self.assertEqual(self.reserve(api, initialize=True), 2214)
        self.assertEqual(state['writes'], 1)
        self.assertEqual(self.current()['build'], 2214)

    def test_active_legacy_allocator_prevents_overlapping_counter_initialization(self):
        api, state = self.service(initial=None, workflow_state='active', legacy=100)
        with self.assertRaisesRegex(r.SharedUnavailable, 'still active') as caught:
            self.reserve(api, initialize=True)
        self.assertEqual(caught.exception.floor, 2213)
        self.assertEqual(state['writes'], 0)

    def test_ordinary_build_never_recreates_absent_shared_counter(self):
        api, state = self.service(initial=None)
        with self.assertRaisesRegex(r.SharedUnavailable, '--initialize-counter'):
            self.reserve(api)
        self.assertEqual(state['writes'], 0)

    def test_active_workflow_floor_is_retained_before_unattended_fallback_failure(self):
        api, _ = self.service(initial=None, workflow_state='active', legacy=100)
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(api), patch.dict(os.environ, {'CI': '1'}):
            with self.assertRaisesRegex(r.ReservationError, 'greater than 2213'):
                r.reserve_resilient(0, self.receipts)
        self.assertEqual(self.current()['build'], 2213)
        self.assertTrue(self.current()['claimed'])

    def test_deletion_of_file_or_entire_directory_recovers_from_shared_counter(self):
        api, _ = self.service()
        self.assertEqual(self.reserve(api), 2172)
        (self.receipts / 'current.json').unlink()
        self.assertEqual(self.reserve(api), 2173)
        shutil.rmtree(self.receipts)
        self.assertEqual(self.reserve(api), 2174)
        self.assertEqual([p.name for p in self.receipts.iterdir()], ['current.json'])

    def test_corrupt_cache_json_types_and_invalid_utf8_recover(self):
        api, _ = self.service()
        self.receipts.mkdir(parents=True)
        for invalid in (b'{bad', b'[]', b'null', b'\xff\xfe'):
            (self.receipts / 'current.json').write_bytes(invalid)
            n = self.reserve(api)
            self.assertGreater(n, 2171)
            self.assertEqual(self.current()['build'], n)

    def test_higher_current_state_is_a_floor_and_consumed_build_cannot_be_reused(self):
        api, _ = self.service()
        r.migrate_state(2300, self.receipts)
        self.assertEqual(self.reserve(api), 2301)
        r.claim_build(2301, self.receipts)
        with self.assertRaisesRegex(r.ReservationError, 'consumed'):
            r.claim_build(2301, self.receipts)
        with patch.dict(os.environ, {r.OVERRIDE: '2301'}):
            with self.assertRaisesRegex(r.ReservationError, 'greater than 2301'):
                r.reserve_resilient(0, self.receipts)

    def test_concurrent_claims_have_one_winner(self):
        api, _ = self.service()
        number = self.reserve(api)
        def claim(_):
            try:
                r.claim_build(number, self.receipts)
                return True
            except r.ReservationError:
                return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(claim, range(2))), [False, True])
        self.assertEqual(self.current()['state'], 'claimed')

    def test_uncertain_update_is_not_retried_and_pending_number_cannot_be_claimed(self):
        api, state = self.service()
        def lost(method, endpoint, payload=None, **kwargs):
            result = api(method, endpoint, payload)
            if method == 'PATCH':
                raise r.SharedUnavailable('response lost')
            return result
        with self.assertRaisesRegex(r.SharedUnavailable, 'response lost'):
            self.reserve(lost)
        self.assertEqual(state['writes'], 1)
        self.assertEqual(self.current()['state'], 'pending')
        with self.assertRaisesRegex(r.ReservationError, 'uncertain'):
            r.claim_build(2172, self.receipts)
        self.assertEqual(self.reserve(api), 2173)

    def test_uncertain_update_manual_fallback_must_exceed_pending_candidate(self):
        api, _ = self.service()
        def lost(method, endpoint, payload=None, **kwargs):
            result = api(method, endpoint, payload)
            if method == 'PATCH':
                raise r.SharedUnavailable('response lost')
            return result
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(lost), patch.object(r, 'manual_reservation', side_effect=r.ReservationError('prompt')) as manual:
            with self.assertRaisesRegex(r.ReservationError, 'prompt'):
                r.reserve_resilient(0, self.receipts)
        self.assertEqual(manual.call_args.args[0], 2172)

    def test_outage_after_reading_higher_shared_counter_preserves_that_floor(self):
        api, _ = self.service(initial=2400)
        def lost(method, endpoint, payload=None, **kwargs):
            if endpoint == 'git/commits':
                raise r.SharedUnavailable('commit request unavailable')
            return api(method, endpoint, payload)
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(lost), patch.dict(os.environ, {'CI': '1'}):
            with self.assertRaisesRegex(r.ReservationError, 'greater than 2400'):
                r.reserve_resilient(0, self.receipts)
        self.assertEqual(self.current()['build'], 2400)

    def test_outage_after_reading_legacy_history_preserves_that_floor(self):
        api, _ = self.service(initial=None, legacy=100)
        def lost(method, endpoint, payload=None, **kwargs):
            if endpoint == 'git/ref/heads/main':
                raise r.SharedUnavailable('default branch unavailable')
            return api(method, endpoint, payload)
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(lost), patch.dict(os.environ, {'CI': '1'}):
            with self.assertRaisesRegex(r.ReservationError, 'greater than 2213'):
                r.reserve_resilient(0, self.receipts, initialize=True)
        self.assertEqual(self.current()['build'], 2213)

    def test_races_are_bounded_and_never_force_update(self):
        api, state = self.service()
        def conflicts(method, endpoint, payload=None, **kwargs):
            if method == 'PATCH':
                self.assertIs(payload['force'], False)
                raise r.ApiError(422)
            return api(method, endpoint, payload)
        with patch.object(r.time, 'sleep'), self.assertRaisesRegex(r.SharedUnavailable, 'eight'):
            self.reserve(conflicts)
        self.assertEqual(len([c for c in state['calls'] if c[1] == 'git/commits']), 8)

    def test_atomic_write_failure_keeps_old_state_and_removes_own_temporary(self):
        r.migrate_state(2200, self.receipts)
        before = (self.receipts / 'current.json').read_bytes()
        with patch.object(r.os, 'replace', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                r.save_current(self.receipts, r.recovered_state(2201))
        self.assertEqual((self.receipts / 'current.json').read_bytes(), before)
        self.assertEqual([p.name for p in self.receipts.iterdir()], ['current.json'])

    def test_interrupted_flush_cannot_replace_current_or_leave_temporary(self):
        r.migrate_state(2200, self.receipts)
        before = (self.receipts / 'current.json').read_bytes()
        with patch.object(r.os, 'fsync', side_effect=OSError('interrupted flush')):
            with self.assertRaises(OSError):
                r.save_current(self.receipts, r.recovered_state(2201))
        self.assertEqual((self.receipts / 'current.json').read_bytes(), before)
        self.assertEqual([p.name for p in self.receipts.iterdir()], ['current.json'])

    def test_local_disk_error_never_falls_back_to_manual(self):
        api, _ = self.service()
        with patch.object(r.shutil, 'which', return_value='gh'), self.mocks(api), patch.object(r.os, 'replace', side_effect=OSError('disk full')), patch.object(r, 'manual_reservation') as manual:
            with self.assertRaises(OSError):
                r.reserve_resilient(0, self.receipts)
        manual.assert_not_called()

    def test_receipt_migration_cleans_only_owned_files_and_preserves_highest_floor(self):
        self.receipts.mkdir(parents=True)
        for name, body in [('2250.json', '{}'), ('2250.claimed', '{}'), ('request-' + 'b' * 32 + '.json', '{}'), ('.current-abcd1234.tmp', 'partial')]:
            (self.receipts / name).write_text(body)
        for name in ('keep.txt', 'manifest.json', '.current-notes.tmp', 'request-not-a-uuid.json'):
            (self.receipts / name).write_text('keep')
        self.assertEqual(r.migrate_state(2113, self.receipts), 2250)
        self.assertEqual(sorted(p.name for p in self.receipts.iterdir()), ['.current-notes.tmp', 'current.json', 'keep.txt', 'manifest.json', 'request-not-a-uuid.json'])
        with self.assertRaises(r.ReservationError):
            r.claim_build(2250, self.receipts)

    def test_legacy_receipts_feed_floor_before_shared_allocation(self):
        self.receipts.mkdir(parents=True)
        (self.receipts / '2240.json').write_text(json.dumps({'build': 2241}))
        api, _ = self.service()
        self.assertEqual(self.reserve(api), 2242)
        self.assertEqual([p.name for p in self.receipts.iterdir()], ['current.json'])

    def test_recognized_archived_receipts_are_consolidated_without_deleting_unrelated_files(self):
        archived = self.receipts / 'migration-through-2400'
        archived.mkdir(parents=True)
        (archived / '2401.json').write_text(json.dumps({'build': 2402}))
        (archived / '2401.claimed').write_text('{}')
        empty = self.receipts / 'migration-through-2300'
        empty.mkdir()
        unrelated = self.receipts / 'notes'
        unrelated.mkdir();(unrelated / '9999.json').write_text('keep')
        self.assertEqual(r.migrate_state(2171, self.receipts), 2402)
        self.assertFalse(archived.exists())
        self.assertFalse(empty.exists())
        self.assertEqual((unrelated / '9999.json').read_text(), 'keep')

    def test_manual_override_has_precedence_is_marked_manual_and_claimed_once(self):
        with patch.dict(os.environ, {r.OVERRIDE: '2175'}), patch.object(r, 'github') as api:
            self.assertEqual(r.reserve_resilient(2171, self.receipts), 2175)
        api.assert_not_called()
        self.assertEqual(self.current()['backend'], 'manual')
        r.claim_build(2175, self.receipts)
        with self.assertRaisesRegex(r.ReservationError, 'consumed'):
            r.claim_build(2175, self.receipts)

    def test_manual_invalid_empty_negative_non_integer_and_consumed_overrides_fail(self):
        for value in ('', '2171', '2170', '-1', '2.5', 'true', '123; echo bad', '9' * 16):
            with self.subTest(value=value), patch.dict(os.environ, {r.OVERRIDE: value}):
                with self.assertRaisesRegex(r.ReservationError, 'greater than 2171'):
                    r.reserve_resilient(2171, self.receipts)

    def test_missing_cli_auth_network_actions_and_http_outages_offer_manual_path(self):
        errors = [r.SharedUnavailable('missing gh'), r.ApiError(401), r.ApiError(403), r.ApiError(500), r.SharedUnavailable('Actions unavailable'), r.SharedUnavailable('network timeout')]
        for error in errors:
            with self.subTest(error=str(error)), patch.object(r, '_reserve_shared', side_effect=error), patch.object(r, 'manual_reservation', return_value=2173) as fallback:
                self.assertEqual(r.reserve_resilient(2171, self.receipts), 2173)
                self.assertEqual(fallback.call_args.args[0], 2171)

    def test_no_tty_unattended_has_actionable_override_error(self):
        with patch.object(r, '_reserve_shared', side_effect=r.SharedUnavailable('offline')), patch('builtins.open', side_effect=OSError('no controlling tty')):
            with self.assertRaisesRegex(r.ReservationError, 'SCD_BUILD_NUMBER.*2171'):
                r.reserve_resilient(2171, self.receipts)

    def test_explicit_ci_never_prompts(self):
        with patch.dict(os.environ, {'CI': '1'}), patch.object(r, '_reserve_shared', side_effect=r.SharedUnavailable('offline')), patch('builtins.open') as tty:
            with self.assertRaisesRegex(r.ReservationError, 'Unattended.*SCD_BUILD_NUMBER'):
                r.reserve_resilient(2171, self.receipts)
        tty.assert_not_called()

    def test_manual_override_cannot_pretend_to_initialize_shared_counter(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/reserve_package_build.py'),
                                 '--initialize-counter', '--receipts', str(self.receipts)],
                                env=dict(self.exec_env, SCD_BUILD_NUMBER='2172'),
                                capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unset SCD_BUILD_NUMBER', result.stderr)
        self.assertFalse((self.receipts / 'current.json').exists())

    def test_service_errors_are_redacted_and_requests_have_timeouts(self):
        for detail in ('HTTP 401 secret-token', 'HTTP 403 secret-token', 'HTTP 500 secret-token', 'secret-token'):
            with patch.object(r.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '', detail)) as run:
                with self.assertRaises(r.SharedUnavailable) as caught:
                    r.github('GET', '')
                self.assertNotIn('secret-token', str(caught.exception))
                self.assertEqual(run.call_args.kwargs['timeout'], 20)
        with patch.object(r.subprocess, 'run', side_effect=subprocess.TimeoutExpired('gh', 20)):
            with self.assertRaisesRegex(r.SharedUnavailable, 'timed out'):
                r.github('PATCH', 'git/refs/x', {})

    def test_busy_service_has_finite_deadline(self):
        api, _ = self.service()
        with patch.object(r.time, 'monotonic', side_effect=[0, 121]):
            with self.assertRaisesRegex(r.SharedUnavailable, 'deadline'):
                self.reserve(api)

    def test_malformed_api_and_wrong_repository_do_not_allocate(self):
        for output in ('broken', '[]', 'null', '1'):
            with patch.object(r.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, output, '')):
                with self.assertRaises(r.SharedUnavailable):
                    r.github('GET', '')
        for repository in ({'full_name': 'fork/other', 'default_branch': 'main'}, {'full_name': r.REPOSITORY, 'default_branch': 'main', 'permissions': {'push': False}}):
            with patch.object(r.shutil, 'which', return_value='gh'), patch.object(r, 'github', return_value=repository):
                with self.assertRaises(r.SharedUnavailable):
                    r.preflight()

    def test_malformed_shared_counter_is_not_reset(self):
        api, state = self.service()
        state['commits']['a' * 40]['message'] = 'unrelated commit'
        with self.assertRaises(r.SharedUnavailable):
            self.reserve(api)
        self.assertEqual(state['writes'], 0)

    def metadata(self, filename, number):
        p = self.root / filename
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f'[install]\nbuild = {number}\n')
        return p

    def archive(self, filename, number):
        p = self.root / 'archives' / filename
        p.parent.mkdir(parents=True, exist_ok=True)
        data = f'[install]\nbuild = {number}\n'.encode()
        with tarfile.open(p, 'w:gz') as archive:
            info = tarfile.TarInfo(r.APP_ID + '/default/app.conf')
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        return p

    def test_metadata_recovery_across_profiles_versions_alternate_suffix_and_installed_floor(self):
        source = self.metadata('source.conf', 0)
        ledger = self.root / 'release.json'
        ledger.write_text(json.dumps({'build_allocations': [{'version': 'old', 'build': 2170}]}))
        archives = [self.archive(r.APP_ID + '-0.0.1-2172.tar.gz', 2172), self.archive('developer/' + r.APP_ID + '-1.0.90-2174-developer.tgz', 2174), self.archive('preview/' + r.APP_ID + '-9.0-2173-preview.tar.gz', 2173)]
        target = self.metadata('target.conf', 2175)
        stage = self.metadata('stage.conf', 2176)
        self.assertEqual(r.local_floor(source, ledger, self.root / 'archives', target, stage), 2176)
        api, _ = self.service()
        self.assertEqual(self.reserve(api, r.local_floor(source, ledger, self.root / 'archives', target, stage)), 2177)
        self.assertTrue(all(p.exists() for p in archives))

    def test_embedded_build_not_version_or_archive_filename_controls_floor(self):
        self.archive(r.APP_ID + '-99.0-1-retained.tgz', 2400)
        self.assertEqual(r.local_floor(self.metadata('source.conf', 0), None, self.root / 'archives'), 2400)

    def test_missing_local_history_still_uses_existing_shared_sequence(self):
        floor = r.local_floor(self.metadata('source.conf', 0), self.root / 'missing.json', self.root / 'missing-dist')
        api, _ = self.service(initial=2400)
        self.assertEqual(self.reserve(api, floor), 2401)

    def test_corrupt_archive_and_metadata_fail_even_with_manual_override(self):
        source = self.metadata('source.conf', 0)
        bad = self.root / 'archives' / (r.APP_ID + '-bad.tar.gz')
        bad.parent.mkdir();bad.write_text('not a tarball')
        with patch.dict(os.environ, {r.OVERRIDE: '9999'}), self.assertRaises(r.ReservationError):
            r.local_floor(source, None, bad.parent)
        bad.unlink()
        source.write_text('[install]\nbuild=bad\n')
        with self.assertRaises(r.ReservationError):
            r.local_floor(source, None, bad.parent)

    def test_packager_propagates_metadata_and_claims_before_compilation(self):
        package = (ROOT / 'packages/splunk-cisco-dashboards/bin/package_app.sh').read_text()
        block = package.split('new_build="$(python3 ', 1)[1].split('if [[ "$FROM_STAGE"', 1)[0]
        self.assertIn('--app-conf "$APP_CONF"', block)
        self.assertIn('--release-ledger', block)
        self.assertIn('--target-app-conf "${SPLUNK_HOME:-/opt/splunk}', block)
        self.assertIn('--stage-app-conf', block)
        self.assertLess(block.index('--claim "$new_build"'), block.index('ensure_build_dependencies.py'))
        wrapper = (ROOT / 'build.sh').read_text()
        self.assertIn('export SPLUNK_HOME', wrapper)
        self.assertIn('LOCAL_BUILD_LOCK="${DIST_DIR}/.packaging.lock"', package)
        no_build = wrapper.split('if [[ "$no_build" -eq 1 ]]; then', 1)[1].split('elif ', 1)[0]
        self.assertNotIn('reserve_package_build', no_build)

    def test_real_packager_claims_override_and_preserves_dependency_failure(self):
        fixture = self.root / 'fixture'
        package = fixture / 'packages' / r.APP_ID
        (package / 'bin').mkdir(parents=True)
        (fixture / 'scripts').mkdir()
        (fixture / 'releases').mkdir()
        (fixture / 'VERSION').write_text('1.0.90\n')
        source = package / 'src/main/resources/splunk/default/app.conf'
        source.parent.mkdir(parents=True)
        source.write_text('[install]\nbuild = 0\n')
        (fixture / 'releases/splunkbase-9257.json').write_text(json.dumps({'build_allocations': [{'build': 2171}]}))
        shutil.copy2(ROOT / 'scripts/reserve_package_build.py', fixture / 'scripts')
        shutil.copy2(ROOT / 'packages' / r.APP_ID / 'bin/package_app.sh', package / 'bin')
        (package / 'bin/validate_release_identity.js').write_text('// unrelated validation stub\n')
        (fixture / 'scripts/validate_dashboard_time_inputs.py').write_text('# unrelated validation stub\n')
        (fixture / 'scripts/ensure_build_dependencies.py').write_text('raise SystemExit(17)\n')
        target = fixture / 'splunk/etc/apps' / r.APP_ID / 'default/app.conf'
        target.parent.mkdir(parents=True)
        target.write_text('[install]\nbuild = 2650\n')
        env = dict(self.exec_env, SCD_BUILD_NUMBER='2700', SPLUNK_HOME=str(fixture / 'splunk'), CI='1', NODE_OPTIONS='--max-old-space-size=4096')
        result = subprocess.run(['bash', str(package / 'bin/package_app.sh'), '--developer'], env=env, cwd=fixture, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 17, result.stderr)
        state = json.loads((fixture / 'dist/build-reservations/current.json').read_text())
        self.assertEqual(state['build'], 2700)
        self.assertEqual(state['state'], 'claimed')
        self.assertEqual(state['backend'], 'manual')
        self.assertFalse((fixture / 'dist/.packaging.lock').exists())
        self.assertEqual(source.read_text(), '[install]\nbuild = 0\n')
        self.assertEqual(target.read_text(), '[install]\nbuild = 2650\n')
        self.assertFalse(list((fixture / 'dist').rglob('*.tar.gz')))
        # Reject a lower override against the actual selected installed target.
        env[r.OVERRIDE] = '2600'
        (fixture / 'dist/build-reservations/current.json').unlink()
        result = subprocess.run(['bash', str(package / 'bin/package_app.sh'), '--developer'], env=env, cwd=fixture, capture_output=True, text=True, timeout=30)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('greater than 2650', result.stderr)
        self.assertFalse((fixture / 'dist/.packaging.lock').exists())

    @unittest.skipUnless(os.name == 'posix', 'controlling-terminal test')
    def test_prompt_visible_on_tty_when_stdout_and_stderr_are_captured(self):
        import pty, select, signal, termios, time
        pid, fd = pty.fork()
        if pid == 0:
            env = os.environ.copy()
            env.pop(r.OVERRIDE, None);env.pop('CI', None)
            code = ("import sys;from pathlib import Path;sys.path.insert(0," + repr(str(ROOT / 'scripts')) + ");"
                    "import reserve_package_build as r;r.manual_reservation(2171,Path(" + repr(str(self.receipts)) + "),'offline')")
            # Equivalent to run_quietly/cmd-substitution: both output channels
            # captured, while the controlling terminal remains available.
            for descriptor, filename in ((1, 'captured-out'), (2, 'captured-err')):
                output = os.open(self.root / filename, os.O_WRONLY | os.O_CREAT, 0o600)
                os.dup2(output, descriptor)
                os.close(output)
            os.execve(sys.executable, [sys.executable, '-c', code], env)
        # Some launchers leave inherited PTYs in raw/input-translation modes.
        # Model a normal interactive terminal explicitly, independently of CI.
        attributes = termios.tcgetattr(fd)
        attributes[0] = (attributes[0] | termios.ICRNL) & ~(termios.INLCR | termios.IGNCR)
        attributes[3] |= termios.ICANON | termios.ECHO
        termios.tcsetattr(fd, termios.TCSANOW, attributes)
        transcript = b''
        try:
            deadline = time.monotonic() + 12
            while b'greater than 2171:' not in transcript and time.monotonic() < deadline:
                if select.select([fd], [], [], .1)[0]:
                    transcript += os.read(fd, 4096)
            self.assertIn(b'greater than 2171:', transcript)
            os.write(fd, b'2172\n')
            status = None
            while time.monotonic() < deadline:
                done, value = os.waitpid(pid, os.WNOHANG | os.WUNTRACED)
                if done:
                    if os.WIFSTOPPED(value):
                        self.fail(f'terminal child stopped by signal {os.WSTOPSIG(value)}; transcript={transcript!r}')
                    status = value;pid = None;break
                if select.select([fd], [], [], .02)[0]:
                    try:
                        transcript += os.read(fd, 4096)
                    except OSError:
                        pass
            self.assertEqual(status, 0, transcript.decode(errors='replace') + (self.root / 'captured-err').read_text())
            self.assertEqual(self.current()['build'], 2172)
            self.assertNotIn('Enter a coordinated', (self.root / 'captured-err').read_text())
        finally:
            os.close(fd)
            if pid is not None:
                os.kill(pid, signal.SIGKILL);os.waitpid(pid, 0)


if __name__ == '__main__':
    unittest.main()
