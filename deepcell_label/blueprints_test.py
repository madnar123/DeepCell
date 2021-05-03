"""Test for DeepCell Label Blueprints"""

import io

import pytest
import numpy as np

# from flask_sqlalchemy import SQLAlchemy

import models
from conftest import DummyLoader


# Automatically enable transactions for all tests, without importing any extra fixtures.
@pytest.fixture(autouse=True)
def enable_transactional_tests(db_session):
    db_session.autoflush = False
    pass


class Bunch(object):
    def __init__(self, **kwds):
        self.__dict__.update(kwds)


def test_health(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json.get('message') == 'success'


def test_raw(client):
    project = models.Project.create(DummyLoader())
    response = client.get(f'/api/raw/{project.token}/0/0')
    assert response.status_code == 200


def test_labeled(client):
    project = models.Project.create(DummyLoader())
    response = client.get(f'/api/labeled/{project.token}/0/0')
    assert response.status_code == 200


def test_array(client):
    project = models.Project.create(DummyLoader())
    response = client.get(f'/api/array/{project.token}/0/0')
    assert response.status_code == 200


def test_edit(client):
    pass


def test_undo(client):
    # Project not found
    response = client.post('/api/undo/0')
    assert response.status_code == 404

    # Create a project
    project = models.Project.create(DummyLoader())

    # Undo with no action to undo silently does nothing
    response = client.post('/api/undo/{}'.format(project.token))
    assert response.status_code == 200


def test_redo(client):
    # Project not found
    response = client.post('/api/redo/0')
    assert response.status_code == 404

    # Create a project
    project = models.Project.create(DummyLoader())

    # Redo with no action to redo silently does nothing
    response = client.post(f'/api/redo/{project.token}')
    assert response.status_code == 200


def test_create_project(client, mocker):
    mocker.patch('blueprints.url_loaders.Loader', lambda *args: DummyLoader())
    response = client.post(f'/api/project')
    assert response.status_code == 200


def test_get_project(client):
    project = models.Project.create(DummyLoader())
    response = client.get(f'/api/project/{project.token}')
    assert response.status_code == 200


def test_get_project_missing(client):
    pass
    # response = client.get('/project/abc')
    # assert response.status_code == 404


# def test_project_finished(client):
#     project = models.Project.create(DummyLoader())
#     project.finish()
#     response = client.get(f'/project/{project.token}')
#     assert response.status_code == 410


# def test_download_project(client, mocker):
#     project = models.Project.create(DummyLoader())
#     mocked_export = mocker.patch('blueprints.exporters.Exporter.export',
#                                  return_value=io.BytesIO())
#     response = client.get(f'/downloadproject/{project.token}')
#     assert response.status_code == 200
#     mocked_export.assert_called()


# def test_upload_to_s3_npz(client, mocker):
#     project = models.Project.create(DummyLoader(path='test.npz'))
#     mocked_export = mocker.patch('blueprints.exporters.S3Exporter.export')
#     response = client.get(f'/api/upload/caliban-output/{project.token}')
#     assert response.status_code == 302
#     mocked_export.assert_called()


# def test_upload_to_s3_trk(client, mocker):
#     project = models.Project.create(DummyLoader(path='test.trk'))
#     mocked_export = mocker.patch('blueprints.exporters.S3Exporter.export')
#     response = client.get(f'/api/upload/caliban-output/{project.token}')
#     assert response.status_code == 302
#     mocked_export.assert_called()


# def test_upload_to_s3_missing(client, mocker):
#     mocker.patch('blueprints.exporters.S3Exporter.export')
#     response = client.get('/api/upload/caliban-output/1')
#     assert response.status_code == 404