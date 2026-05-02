# Getting Started

* Add the appropriate [GitHub Topics](https://splunk.atlassian.net/wiki/spaces/FO/pages/1078322782474/Team+Best+Practices#GitHub-Topics) to your repository by following [instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics#adding-topics-to-your-repository)
* Replace the current `README.md` with `README-template.md` after having completed, at least, the mandatory sections
* Structure your code as per [below](#repository-structure)
* Understand usage and troubleshooting of provided [automation](#cicd-automation) pipelines
* (optional) Understand how to add [extensive documentation](#documentation)

## Repository structure
```
.
├── README.md
├── docs
│   └── index.md
├── package
|   ├── README.txt
│   ├── README
│   ├── LICENSES
|   |   └── LICENSE.txt
│   ├── app.manifest
│   ├── appserver
│   ├── bin
│   ├── default
│   ├── metadata
│   └── static
├── etc
└── tests
    ├── conftest.py
    └── pytest.ini
```

* `README` to set expectations and give usage instructions
* `docs` contains further documentation when needed
* `.gitignore` to ignore hidden or OS_ files
* `etc/` contains additional files such as images, configuration files, etc
* `package/` contains Splunk App / Add-on Source Files
* `tests/` contains files for unit testing, e2e testing, mocks, postman collections, etc

:point_right: Files needed for local development, packaging and local execution such as for example `docker-compose.yml`, `Makefile`, `pyproject.toml` or `poetry.lock` shall be added in the root folder.

## CI/CD Automation
This template provide the following pipeline(s) OOB:

| Workflow Name   | Trigger   | Description                                        |
|----------------|-----|----------------------------------------------------|
|`build-appinspect-release`   | <li>Open / Re-open / Synch PR to `main`</li><li>Push to `main` with changes to files in `package/`</li><li>Push a tag to the repository</li> | <li> Build the app if a TA built via UCC framework</li><li>Package and run appinspect</li><li>Create a release and add the packaged app \:grey_exclamation: *only when the trigger is pushing a tag*</li>  |
|`readme-linting`| <li>Open / Re-open / Synch PR to `main`</li><li>Push to `main`</li> | Validate `README.md` content |

### Troubleshooting
| Workflow Name   | Failure   | Solution   |
|-----------------|-----------|------------|
|`build-appinspect-release` | AppInspect fails but the report summary shows no errors | Expand the `manual_checks`, perform those manual checks and confirm their resolution by adding them in the `.appinspect.manualcheck.yaml` <br><br> *Follow the structure of the examples given in the file* |

## Documentation
Any further technical specification shall be added to dedicated markdown files under `docs`. Check for example https://github.com/splunk/genesys_cloud_ta.
