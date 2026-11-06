"""Shared-number protocol tests; no live GitHub dispatches or credentials."""

import concurrent.futures
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("reservation", ROOT / "scripts/reserve_package_build.py")
reservation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reservation)


class SharedBuildTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.temp = Path(temp.name)
        auth = patch.object(reservation.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "", ""))
        auth.start()
        self.addCleanup(auth.stop)

    def service(self):
        runs = []
        lock = threading.Lock()

        def api(method, endpoint, payload=None):
            if endpoint == "":
                return {"full_name": reservation.REPOSITORY, "default_branch": "develop", "permissions": {"push": True}}
            if endpoint.endswith(".yml"):
                return {"id": 17, "state": "active", "path": ".github/workflows/" + reservation.WORKFLOW}
            if method == "POST":
                self.assertEqual(payload["ref"], "develop")
                with lock:
                    number = len(runs) + 1
                    runs.append({"id": 100 + number, "workflow_id": 17,
                                 "event": "workflow_dispatch", "run_number": number,
                                 "display_title": reservation.PREFIX + payload["inputs"]["request_id"]})
                return None
            return {"workflow_runs": list(runs)}
        return api, runs

    def test_two_new_laptops_reserve_distinct_numbers_and_match_own_requests(self):
        api, runs = self.service()
        with tempfile.TemporaryDirectory() as directory, patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=api):
            roots = [Path(directory) / "laptop-a", Path(directory) / "laptop-b"]
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda root: reservation.reserve_build(0, root), roots))
            self.assertEqual(set(results), {2114, 2115})
            self.assertEqual(len(runs), 2)
            for root, number in zip(roots, results):
                receipt = json.loads((root / f"{number}.json").read_text())
                run = next(run for run in runs if run["id"] == receipt["run_id"])
                self.assertEqual(run["display_title"], reservation.PREFIX + receipt["request_id"])

    def test_reserved_number_below_installed_floor_is_not_locally_incremented(self):
        api, _ = self.service()
        with tempfile.TemporaryDirectory() as directory, patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=api):
            with self.assertRaisesRegex(reservation.ReservationError, "not above existing build 9999"):
                reservation.reserve_build(9999, Path(directory))
            self.assertTrue((Path(directory) / "2114.json").exists())

    def test_dispatch_failure_is_never_retried(self):
        api, _ = self.service()
        calls = []
        def fail_dispatch(method, endpoint, payload=None):
            calls.append(method)
            if method == "POST":
                raise reservation.ReservationError("Lost response")
            return api(method, endpoint, payload)
        with patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=fail_dispatch):
            with self.assertRaisesRegex(reservation.ReservationError, "Lost response"):
                reservation.reserve_build(0, self.temp / "unused")
        self.assertEqual(calls.count("POST"), 1)

    def test_timeout_does_not_guess_number_or_redispatch(self):
        api, runs = self.service()
        def hidden_run(method, endpoint, payload=None):
            result = api(method, endpoint, payload)
            return {"workflow_runs": []} if "/runs?" in endpoint else result
        with patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=hidden_run), patch.object(reservation.time, "monotonic", side_effect=[0, 1, 121]), patch.object(reservation.time, "sleep"):
            with self.assertRaisesRegex(reservation.ReservationError, "not visible"):
                reservation.reserve_build(0, self.temp / "unused")
        self.assertEqual(len(runs), 1)

    def test_inactive_workflow_does_not_dispatch(self):
        api, runs = self.service()
        def inactive(method, endpoint, payload=None):
            result = api(method, endpoint, payload)
            if endpoint.endswith(".yml"):
                result["state"] = "disabled_manually"
            return result
        with patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=inactive):
            with self.assertRaisesRegex(reservation.ReservationError, "inactive"):
                reservation.reserve_build(0, self.temp / "unused")
        self.assertEqual(runs, [])

    def test_gh_errors_do_not_echo_credential_or_network_details(self):
        with patch.object(reservation.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", "secret-token")):
            with self.assertRaises(reservation.ReservationError) as caught:
                reservation.github("GET", "")
        self.assertNotIn("secret-token", str(caught.exception))

    def test_reservation_can_only_be_claimed_once(self):
        api, _ = self.service()
        with tempfile.TemporaryDirectory() as directory, patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=api):
            root = Path(directory)
            number = reservation.reserve_build(0, root)
            reservation.claim_build(number, root)
            with self.assertRaisesRegex(reservation.ReservationError, "already used"):
                reservation.claim_build(number, root)
            with self.assertRaisesRegex(reservation.ReservationError, "Missing build reservation"):
                reservation.claim_build(1, root)

    def test_rejected_floor_reservation_cannot_be_claimed_manually(self):
        api, _ = self.service()
        with tempfile.TemporaryDirectory() as directory, patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=api):
            root = Path(directory)
            with self.assertRaises(reservation.ReservationError):
                reservation.reserve_build(9999, root)
            with self.assertRaisesRegex(reservation.ReservationError, "Invalid build reservation"):
                reservation.claim_build(2114, root)

    def test_missing_cli_and_bad_auth_stop_before_api(self):
        with patch.object(reservation.shutil, "which", return_value=None), patch.object(reservation, "github") as api:
            with self.assertRaisesRegex(reservation.ReservationError, "Dependency failure"):
                reservation.preflight()
            api.assert_not_called()
        with patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", "secret")), patch.object(reservation, "github") as api:
            with self.assertRaisesRegex(reservation.ReservationError, "Authentication failure"):
                reservation.preflight()
            api.assert_not_called()

    def test_http_errors_are_classified_without_secrets(self):
        for status, endpoint, expected in [(401, "", "Authentication"), (403, "", "Permission"), (404, "", "Repository access"), (404, "actions/workflows/x", "Activation")]:
            with self.subTest(status=status, endpoint=endpoint), patch.object(reservation.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", f"HTTP {status} secret-token")):
                with self.assertRaisesRegex(reservation.ReservationError, expected) as caught:
                    reservation.github("GET", endpoint)
                self.assertNotIn("secret-token", str(caught.exception))

    def test_malformed_json_and_transport_timeout(self):
        for output in ["broken", "[]", "1"]:
            with patch.object(reservation.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, output, "")):
                with self.assertRaisesRegex(reservation.ReservationError, "invalid reservation metadata"):
                    reservation.github("GET", "")
        with patch.object(reservation.subprocess, "run", side_effect=subprocess.TimeoutExpired("gh", 20)):
            with self.assertRaisesRegex(reservation.ReservationError, "timed out"):
                reservation.github("POST", "dispatches", {})

    def test_bad_run_identity_and_ambiguous_matches_fail_closed(self):
        for mutation in [lambda run: run.update(run_number=True), lambda run: run.update(workflow_id=99), lambda run: run.update(event="push"), lambda run: run.update(id=-1), lambda run: None]:
            api, runs = self.service()
            def malformed(method, endpoint, payload=None):
                value = api(method, endpoint, payload)
                if "/runs?" in endpoint:
                    mutation(runs[0])
                    if runs[0].get("run_number") == 1 and runs[0].get("workflow_id") == 17 and runs[0].get("event") == "workflow_dispatch" and runs[0].get("id") == 101:
                        value["workflow_runs"] *= 2
                return value
            with tempfile.TemporaryDirectory() as directory, patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=malformed):
                with self.assertRaises(reservation.ReservationError):
                    reservation.reserve_build(0, Path(directory))
                self.assertFalse(list(Path(directory).glob("[0-9]*.json")))

    def test_concurrent_claims_have_exactly_one_winner(self):
        api, _ = self.service()
        with tempfile.TemporaryDirectory() as directory, patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=api):
            root = Path(directory)
            number = reservation.reserve_build(0, root)
            def claim(_):
                try:
                    reservation.claim_build(number, root)
                    return True
                except reservation.ReservationError:
                    return False
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                self.assertEqual(sorted(pool.map(claim, range(2))), [False, True])

    def test_wrong_repository_and_read_only_access_stop_dispatch(self):
        for change in [{"full_name": "fork/other"}, {"permissions": {"push": False}}]:
            api, runs = self.service()
            def altered(method, endpoint, payload=None):
                value = api(method, endpoint, payload)
                if endpoint == "": value.update(change)
                return value
            with patch.object(reservation.shutil, "which", return_value="gh"), patch.object(reservation, "github", side_effect=altered):
                with self.assertRaises(reservation.ReservationError):
                    reservation.preflight()
                self.assertEqual(runs, [])



if __name__ == "__main__":
    unittest.main()
