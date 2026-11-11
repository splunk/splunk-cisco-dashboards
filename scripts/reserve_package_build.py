"""Reserve this project's shared build sequence without requiring Actions.

A non-forced Git reference update serializes developers. current.json is a
recoverable local cache; failed or uncertain writes never issue a shared number.
"""

from __future__ import annotations

import argparse
import configparser
from contextlib import contextmanager
import fcntl
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid

HOST = "github.com"
REPOSITORY = "splunk/splunk-cisco-dashboards"
APP_ID = "splunk-cisco-dashboards"
OFFSET = 2113  # Permanent pre-Actions floor; never reset on a version change.
WORKFLOW = "reserve-build-number.yml"  # Read-only legacy sequence history.
COUNTER_REF = "build-reservations/counter"
RECORD_PREFIX = "Dashboards build reservation v2\n"
OVERRIDE = "SCD_BUILD_NUMBER"
MAX_ATTEMPTS = 8
REQUEST_TIMEOUT = 20
RESERVATION_TIMEOUT = 120
MAX_METADATA = 65536


class ReservationError(RuntimeError):
    """Unsafe input or a local reservation failure; do not start packaging."""


class SharedUnavailable(ReservationError):
    """Shared service cannot establish a reservation; offer manual allocation."""

    def __init__(self, message, floor=OFFSET):
        self.floor = floor
        super().__init__(message)


class ApiError(SharedUnavailable):
    def __init__(self, status):
        self.status = status
        super().__init__(f"GitHub API request failed (HTTP {status}); check access and connectivity.")


def github(method, endpoint, payload=None, *, timeout=REQUEST_TIMEOUT):
    command = ["gh", "api", "--hostname", HOST, "--method", method,
               f"repos/{REPOSITORY}/{endpoint}".rstrip("/")]
    if payload is not None:
        command += ["--input", "-"]
    try:
        result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                                capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise SharedUnavailable("GitHub request failed or timed out; a write may have succeeded.") from error
    if result.returncode:
        # Never echo stderr/stdout: gh diagnostics can contain credentials.
        status = re.search(r"\bHTTP\s+(\d{3})\b", result.stderr or "")
        if status:
            raise ApiError(int(status.group(1)))
        raise SharedUnavailable("GitHub request failed; check gh authentication and connectivity.")
    try:
        data = json.loads(result.stdout) if result.stdout.strip() else None
    except ValueError as error:
        raise SharedUnavailable("GitHub returned malformed reservation metadata.") from error
    if not isinstance(data, dict):
        raise SharedUnavailable("GitHub returned invalid reservation metadata.")
    return data


def preflight():
    if not shutil.which("gh"):
        raise SharedUnavailable("GitHub CLI (gh) is unavailable.")
    repository = github("GET", "")
    if (not isinstance(repository.get("full_name"), str)
            or repository["full_name"].lower() != REPOSITORY.lower()
            or not isinstance(repository.get("default_branch"), str)
            or not repository["default_branch"]):
        raise SharedUnavailable("GitHub did not confirm the canonical Dashboards repository.")
    permissions = repository.get("permissions")
    if not isinstance(permissions, dict) or permissions.get("push") is not True:
        raise SharedUnavailable("Repository Contents write access is required for shared numbering.")
    return repository


def sha(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise SharedUnavailable("Invalid shared-counter commit identity.")
    return value


def read_record(commit):
    message = commit.get("message", "")
    if not isinstance(message, str) or not message.startswith(RECORD_PREFIX):
        raise SharedUnavailable("Unexpected shared-counter content; maintainer review required.")
    try:
        record = json.loads(message[len(RECORD_PREFIX):])
    except ValueError as error:
        raise SharedUnavailable("Malformed shared-counter record.") from error
    if (not isinstance(record, dict) or record.get("repository") != REPOSITORY
            or type(record.get("build")) is not int or record["build"] <= OFFSET
            or not re.fullmatch(r"[0-9a-f]{32}", str(record.get("request_id", "")))):
        raise SharedUnavailable("Invalid shared-counter record; no reset is allowed.")
    return record


@contextmanager
def state_lock(directory):
    """Lock the directory inode, without accumulating persistent lock files."""
    directory.mkdir(parents=True, exist_ok=True)
    fd = os.open(directory, os.O_RDONLY)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ReservationError("Another reservation/claim owns this workspace; use one build at a time.") from error
        yield
    finally:
        os.close(fd)


def _read_json(path):
    # Corrupt cache/legacy receipts are recoverable; actual I/O errors are not.
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except UnicodeError:
        return None
    try:
        value = json.loads(content)
        return value if isinstance(value, dict) else None
    except (ValueError, UnicodeError):
        return None


def _legacy_directories(directory):
    for path in directory.iterdir():
        if (not path.is_symlink() and path.is_dir()
                and re.fullmatch(r"migration-through-[0-9]+", path.name)):
            yield path


def _legacy_paths(directory):
    for root in [directory, *_legacy_directories(directory)]:
        for path in root.iterdir():
            if not path.is_symlink() and path.is_file() and re.fullmatch(
                    r"(?:[0-9]+\.(?:json|claimed)|request-[0-9a-f]{32}\.json)", path.name):
                yield path


def state_floor(directory, floor):
    if type(floor) is not int or floor < 0:
        raise ReservationError("Historical build floor must be a non-negative integer.")
    floor = max(floor, OFFSET)
    for path in _legacy_directories(directory):
        floor = max(floor, int(path.name.rsplit("-", 1)[1]))
    for path in [directory / "current.json", *_legacy_paths(directory)]:
        value = _read_json(path)
        if value is not None and type(value.get("build")) is int and value["build"] >= 0:
            floor = max(floor, value["build"])
        # Old numeric receipts can retain evidence even after partial JSON loss.
        if re.fullmatch(r"[0-9]+\.(?:json|claimed)", path.name):
            floor = max(floor, int(path.name.split(".")[0]))
    return floor


def save_current(directory, receipt):
    directory.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=directory,
                                         prefix=".current-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(receipt, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, directory / "current.json")
        directory_fd = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    # Only allocator-owned obsolete files are eligible. Preserve unrelated files.
    for path in _legacy_paths(directory):
        path.unlink()
    for path in _legacy_directories(directory):
        if not any(path.iterdir()):
            path.rmdir()
    for path in directory.glob(".current-*.tmp"):
        if (re.fullmatch(r"\.current-[a-z0-9_]{8}\.tmp", path.name)
                and not path.is_symlink() and path.is_file()):
            path.unlink()


def _legacy_floor(remote):
    """Only used to seed a missing counter after the old allocator is retired."""
    workflow = remote("GET", f"actions/workflows/{WORKFLOW}")
    if type(workflow.get("id")) is not int or workflow["id"] < 1:
        raise SharedUnavailable("Cannot establish the historical Actions counter identity.")
    data = remote("GET", f"actions/workflows/{WORKFLOW}/runs?per_page=100")
    runs = data.get("workflow_runs")
    if (not isinstance(runs, list) or type(data.get("total_count")) is not int
            or data["total_count"] < 0 or len(runs) != min(data["total_count"], 100)):
        raise SharedUnavailable("Cannot establish the historical Actions build floor.")
    numbers = []
    for run in runs:
        if (not isinstance(run, dict) or type(run.get("run_number")) is not int
                or run["run_number"] < 1 or run.get("workflow_id") != workflow["id"]):
            raise SharedUnavailable("Invalid historical Actions counter data.")
        numbers.append(OFFSET + run["run_number"])
    floor = max([OFFSET, *numbers])
    # Old clients allocate directly from run_number, regardless of runner result.
    # They must stop before a different allocator can safely spend this sequence.
    if workflow.get("state") not in {"disabled_manually", "disabled_inactivity"}:
        raise SharedUnavailable(
            f"Legacy Actions allocator is still active (known floor {floor}). "
            "Retire it and coordinate client migration before initializing the Git counter.", floor=floor)
    return floor


def _reserve_shared(local_floor, directory, initialize=False):
    repository = preflight()
    request_id = uuid.uuid4().hex
    deadline = time.monotonic() + RESERVATION_TIMEOUT

    def remote(method, endpoint, payload=None):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise SharedUnavailable("Shared reservation deadline exceeded; no number was guessed.")
        return github(method, endpoint, payload, timeout=min(REQUEST_TIMEOUT, math.ceil(remaining)))

    for attempt in range(MAX_ATTEMPTS):
        exists = True
        try:
            reference = remote("GET", f"git/ref/{COUNTER_REF}")
        except ApiError as error:
            if error.status != 404:
                raise
            exists = False
            local_floor = max(local_floor, _legacy_floor(remote))
            remember_floor(directory, local_floor)
            if not initialize:
                raise SharedUnavailable(
                    "Shared Git counter is absent; a maintainer must perform the coordinated "
                    "--initialize-counter migration. It is never recreated by an ordinary build.",
                    floor=local_floor)
            reference = remote("GET", f"git/ref/heads/{repository['default_branch']}")
        try:
            parent = sha(reference["object"]["sha"])
            current = remote("GET", f"git/commits/{parent}")
            previous = read_record(current)["build"] if exists else OFFSET
            remember_floor(directory, previous)
            number = max(previous, state_floor(directory, local_floor)) + 1
            record = {"repository": REPOSITORY, "build": number, "request_id": request_id}
            candidate = remote("POST", "git/commits", {
                "message": RECORD_PREFIX + json.dumps(record, sort_keys=True),
                "tree": sha(current["tree"]["sha"]), "parents": [parent],
            })
            commit = sha(candidate["sha"])
        except (KeyError, TypeError, AttributeError) as error:
            raise SharedUnavailable("Invalid shared-counter response; no number was issued.") from error
        receipt = {**record, "backend": "git-ref-v2", "ref": COUNTER_REF,
                   "commit": commit, "claimed": True, "state": "pending"}
        # Durable intent precedes publishing. If the response is lost, manual
        # fallback must be ABOVE this possibly consumed candidate number.
        save_current(directory, receipt)
        try:
            if exists:
                result = remote("PATCH", f"git/refs/{COUNTER_REF}", {"sha": commit, "force": False})
            else:
                result = remote("POST", "git/refs", {"ref": f"refs/{COUNTER_REF}", "sha": commit})
        except ApiError as error:
            if error.status in {409, 422}:
                time.sleep(min(0.05 * 2 ** attempt, 0.5))
                continue
            raise
        if not isinstance(result.get("object"), dict) or result["object"].get("sha") != commit:
            raise SharedUnavailable("GitHub did not confirm the reservation write; no number was issued.")
        receipt.update(state="reserved", claimed=False)
        save_current(directory, receipt)
        print(f"Reserved shared build {number} on {HOST}/{REPOSITORY}.", file=sys.stderr)
        return number
    raise SharedUnavailable("Shared counter remained busy after eight non-forced attempts.")


def reserve_build(floor, directory, initialize=False):
    with state_lock(directory):
        return _reserve_shared(state_floor(directory, floor), directory, initialize)


def claim_build(number, directory):
    with state_lock(directory):
        receipt = _read_json(directory / "current.json")
        if (not receipt or receipt.get("repository") != REPOSITORY
                or type(receipt.get("build")) is not int or receipt["build"] != number
                or number <= OFFSET or receipt.get("backend") not in {"git-ref-v2", "manual"}
                or not re.fullmatch(r"[0-9a-f]{32}", str(receipt.get("request_id", "")))):
            raise ReservationError("Missing or invalid current reservation; reserve a new number.")
        if receipt.get("backend") == "git-ref-v2":
            if receipt.get("ref") != COUNTER_REF or not re.fullmatch(r"[0-9a-f]{40}", str(receipt.get("commit", ""))):
                raise ReservationError("Invalid shared reservation identity.")
        if receipt.get("claimed") is not False or receipt.get("state") != "reserved":
            raise ReservationError("Reservation already consumed or uncertain; reserve another number.")
        receipt.update(claimed=True, state="claimed")
        save_current(directory, receipt)


def manual_reservation(floor, directory, reason, raw=None):
    print(f"WARNING: {reason}", file=sys.stderr)
    if raw is None:
        # Wrappers capture stdout/stderr; use the controlling terminal, not a
        # hidden input() prompt. Explicit CI runs must never wait for input.
        if os.environ.get("CI"):
            raise ReservationError(f"Unattended build: set {OVERRIDE} to a coordinated integer greater than {floor}.")
        try:
            with open("/dev/tty", "w", encoding="utf-8") as terminal, open("/dev/tty", "r", encoding="utf-8") as response:
                terminal.write(f"Shared numbering unavailable. Global uniqueness cannot be verified.\nEnter a coordinated build number greater than {floor}: ")
                terminal.flush()
                raw = response.readline().strip()
        except (OSError, EOFError) as error:
            raise ReservationError(f"No interactive terminal. Set {OVERRIDE} to a coordinated integer greater than {floor}.") from error
    if not isinstance(raw, str) or not re.fullmatch(r"[0-9]{1,15}", raw) or int(raw) <= floor:
        raise ReservationError(f"Manual build number must be an integer greater than {floor}.")
    number = int(raw)
    print(f"WARNING: Build {number} is manually coordinated. Global uniqueness cannot be verified; coordinate it with other developers.", file=sys.stderr)
    save_current(directory, {"repository": REPOSITORY, "build": number, "backend": "manual",
                             "request_id": uuid.uuid4().hex, "state": "reserved", "claimed": False,
                             "reason": reason})
    return number


def reserve_resilient(floor, directory, initialize=False):
    with state_lock(directory):
        floor = state_floor(directory, floor)
        raw = os.environ.get(OVERRIDE)
        if raw is not None:
            return manual_reservation(floor, directory, f"Explicit {OVERRIDE} override", raw)
        try:
            return _reserve_shared(floor, directory, initialize)
        except SharedUnavailable as error:
            # Do not catch disk/metadata/packaging errors. Preserve a possibly
            # published reservation as a floor even after an uncertain response.
            known_floor = state_floor(directory, floor)
            if error.floor > known_floor:
                known_floor = error.floor
                save_current(directory, recovered_state(known_floor))
            return manual_reservation(known_floor, directory, str(error))


def recovered_state(floor):
    return {"repository": REPOSITORY, "build": floor, "backend": "recovered-floor",
            "claimed": True, "state": "consumed", "request_id": uuid.uuid4().hex}


def remember_floor(directory, floor):
    """Retain successful service observations even if the next request fails."""
    highest = state_floor(directory, floor)
    current = _read_json(directory / "current.json")
    if current is None or type(current.get("build")) is not int or current["build"] < highest:
        save_current(directory, recovered_state(highest))


def migrate_state(floor, directory):
    """Consolidate known floors without reserving or enabling reuse of a build."""
    with state_lock(directory):
        current = _read_json(directory / "current.json")
        highest = state_floor(directory, floor)
        # Preserve any legitimate outstanding identity/status if it is highest.
        if current is None or current.get("build") != highest:
            current = recovered_state(highest)
        save_current(directory, current)
        return highest


def read_build(path, content=None):
    if content is None:
        content = Path(path).read_text(encoding="utf-8")
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(content)
        raw = parser.get("install", "build", fallback="").strip()
    except configparser.Error as error:
        raise ReservationError(f"Cannot read [install] build in {path}.") from error
    if not re.fullmatch(r"[0-9]+", raw):
        raise ReservationError(f"Invalid [install] build in {path}.")
    return int(raw)


def local_floor(app_conf, release_ledger, dist, target_app_conf=None, stage_app_conf=None):
    """Read metadata only, including every profile/version/retained archive suffix."""
    values = [OFFSET, read_build(app_conf)]
    if release_ledger is not None and release_ledger.exists():
        try:
            data = json.loads(release_ledger.read_text(encoding="utf-8"))
            allocations = data["build_allocations"]
            if not isinstance(allocations, list):
                raise ValueError()
            for entry in allocations:
                build = entry["build"]
                if type(build) is not int or build < 0:
                    raise ValueError()
                values.append(build)
        except (ValueError, KeyError, TypeError) as error:
            raise ReservationError("Invalid release build-allocation history.") from error
    for path in (target_app_conf, stage_app_conf):
        if path is not None and path.exists():
            values.append(read_build(path))
    for path in sorted(dist.rglob(f"{APP_ID}-*")) if dist.exists() else []:
        if not path.is_file() or not path.name.endswith((".tar.gz", ".tgz")):
            continue
        try:
            with tarfile.open(path, "r|*") as archive:
                for member in archive:
                    if member.name == f"{APP_ID}/default/app.conf" and member.isfile():
                        handle = archive.extractfile(member)
                        with handle:
                            content = handle.read(MAX_METADATA + 1)
                        if len(content) > MAX_METADATA:
                            raise ReservationError(f"Oversized app.conf in {path}.")
                        values.append(read_build(path, content.decode("utf-8")))
                        break
                else:
                    raise ReservationError(f"Missing app.conf in retained archive {path}.")
        except (tarfile.TarError, UnicodeError) as error:
            raise ReservationError(f"Cannot read retained build metadata from {path}.") from error
    return max(values)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--claim", type=int)
    parser.add_argument("--floor", type=int, default=0)
    modes.add_argument("--preflight", action="store_true")
    modes.add_argument("--migrate-state", action="store_true")
    modes.add_argument("--initialize-counter", action="store_true")
    parser.add_argument("--app-conf", type=Path)
    parser.add_argument("--release-ledger", type=Path)
    parser.add_argument("--dist", type=Path)
    parser.add_argument("--target-app-conf", type=Path)
    parser.add_argument("--stage-app-conf", type=Path)
    parser.add_argument("--receipts", required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.preflight:
            preflight()
        elif args.claim is not None:
            claim_build(args.claim, args.receipts)
        else:
            floor = args.floor
            if args.app_conf is not None:
                if args.dist is None:
                    raise ReservationError("--dist is required with --app-conf.")
                floor = max(floor, local_floor(args.app_conf, args.release_ledger, args.dist,
                                               args.target_app_conf, args.stage_app_conf))
            if args.migrate_state:
                print(migrate_state(floor, args.receipts))
            elif args.initialize_counter:
                if os.environ.get(OVERRIDE) is not None:
                    raise ReservationError(f"Unset {OVERRIDE} for shared counter initialization; a manual number cannot initialize it.")
                print(reserve_build(floor, args.receipts, initialize=True))
            else:
                print(reserve_resilient(floor, args.receipts))
    except (ReservationError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
