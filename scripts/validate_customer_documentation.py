#!/usr/bin/env python3
"""Validate customer-facing release history and guide audience boundaries."""
import re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
package=root/'packages/splunk-cisco-dashboards'
version=(root/'VERSION').read_text().strip()
guide=(package/'src/main/webapp/pages/user_guide/userGuide.md').read_text()
readme=(package/'README.md').read_text()
assert re.search(r'^version: '+re.escape(version)+r'$',guide,re.M),'Guide version must match VERSION'
assert version in re.search(r'^::: release (.+)$',guide,re.M).group(1),'Newest guide entry must match VERSION'
release=readme.split('## Release notes',1)[1].split('\n## ',1)[0]
internal=re.compile(r'\b(?:worktree|webpack|build\.sh|CI/CD|pull requests?|build.number allocation|version stamping|unit tests?|regression tests?|test suites?)\b',re.I)
for label,content in [('README release notes',release),('customer guide',guide)]:
 matches=[(i,line) for i,line in enumerate(content.splitlines(),1) if internal.search(line)]
 assert not matches,(label,matches)
print('Customer documentation contract passed: audience boundary, guide version and newest release.')
