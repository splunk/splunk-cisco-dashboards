"""Bootstrap failure and configuration-preservation tests; no package downloads."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deps', Path(__file__).with_name('ensure_build_dependencies.py'))
deps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deps)


class DependencyTests(unittest.TestCase):
    def run_case(self, probe_codes, mutate=False, install_code=0):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'yarn.lock').write_text('locked')
            (root / 'package.json').write_text('{}')
            (root / 'packages').mkdir()
            commands = []
            probes = iter(probe_codes)
            def run(command, **kwargs):
                commands.append(command)
                self.assertEqual(kwargs['env']['NODE_OPTIONS'], '--max-old-space-size=4096')
                self.assertEqual(kwargs['env']['COREPACK_ENABLE_AUTO_PIN'], '0')
                if command[0] == 'node':
                    return subprocess.CompletedProcess(command, next(probes), '', '')
                if command[-1] == '--version':
                    return subprocess.CompletedProcess(command, 0, '1.22.22\n', '')
                self.assertIn('--frozen-lockfile', command)
                self.assertIn('--production=false', command)
                self.assertNotIn('--ignore-scripts', command)
                if mutate:
                    (root / '.yarnrc').write_text('unexpected')
                return subprocess.CompletedProcess(command, install_code)
            with patch.object(deps, 'ROOT', root), patch.object(deps.shutil, 'which', return_value='/bin/tool'), patch.object(deps.subprocess, 'run', side_effect=run), patch.dict(os.environ, {'NODE_ENV': 'production'}):
                deps.ensure()
            return commands

    def test_missing_dependencies_install_dev_packages_and_keep_configuration(self):
        commands = self.run_case([1, 0])
        self.assertEqual(sum('install' in command for command in commands), 1)

    def test_installed_dependencies_do_not_invoke_package_manager(self):
        self.assertEqual(len(self.run_case([0])), 1)

    def test_failed_install_stops_before_compilation(self):
        with self.assertRaisesRegex(RuntimeError, 'installation failed'):
            self.run_case([1], install_code=1)

    def test_unexpected_configuration_change_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'changed locked configuration'):
            self.run_case([1], mutate=True)

    def test_incomplete_install_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'installation failed'):
            self.run_case([1, 1])


if __name__ == '__main__':
    unittest.main()
