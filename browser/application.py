"""Flask application entrypoint"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import logging
from logging.config import dictConfig

from flask import Flask
from flask.logging import default_handler
from flask_cors import CORS

import config
from blueprints import bp
from models import db


class ReverseProxied(object):
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        scheme = environ.get('HTTP_X_FORWARDED_PROTO')
        if scheme:
            environ['wsgi.url_scheme'] = scheme
        return self.app(environ, start_response)


def configure_logging():
    """Set up logging format and instantiate loggers"""
    # Set up logging
    dictConfig({
        'version': 1,
        'formatters': {'default': {
            'format': '[%(asctime)s]:[%(levelname)s]:[%(name)s]: %(message)s',
        }},
        'handlers': {'wsgi': {
            'class': 'logging.StreamHandler',
            'stream': 'ext://flask.logging.wsgi_errors_stream',
            'formatter': 'default'
        }},
        'root': {
            'level': 'INFO',
            'handlers': ['wsgi']
        }
    })

    # set up 3rd party logging.
    logging.getLogger('sqlalchemy').addHandler(default_handler)


def create_app():
    """Factory to create the Flask application"""
    app = Flask(__name__)

    CORS(app)

    app.config.from_object('config')

    app.wsgi_app = ReverseProxied(app.wsgi_app)

    app.jinja_env.auto_reload = True

    db.app = app  # setting context
    db.init_app(app)

    db.create_all()

    app.register_blueprint(bp)

    return app


application = create_app()  # pylint: disable=C0103

if __name__ == '__main__':
    configure_logging()
    application.run('0.0.0.0', port=config.PORT, debug=config.DEBUG)
