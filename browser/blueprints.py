"""Flask blueprint for modular routes."""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import base64
import distutils
import distutils.util
import json
import os
import pickle
import re
import timeit
import traceback

from flask import Blueprint
from flask import jsonify
from flask import render_template
from flask import request
from flask import redirect
from flask import current_app
from werkzeug.exceptions import HTTPException
import numpy as np

from helpers import is_trk_file, is_npz_file
from files import CalibanFile
from models import Project, RawFrame, LabelFrame, Metadata
from caliban import TrackEdit, ZStackEdit, BaseEdit
from imgutils import pngify, add_outlines


bp = Blueprint('caliban', __name__)  # pylint: disable=C0103


@bp.route('/health')
def health():
    """Returns success if the application is ready."""
    return jsonify({'message': 'success'}), 200


@bp.errorhandler(Exception)
def handle_exception(error):
    """Handle all uncaught exceptions"""
    # pass through HTTP errors
    if isinstance(error, HTTPException):
        return error

    current_app.logger.error('Encountered %s: %s',
                             error.__class__.__name__, error, exc_info=1)

    # now you're handling non-HTTP exceptions only
    return jsonify({'message': str(error)}), 500


@bp.route('/upload_file/<int:project_id>', methods=['GET', 'POST'])
def upload_file(project_id):
    '''Upload .trk/.npz data file to AWS S3 bucket.'''
    start = timeit.default_timer()
    # Use id to grab appropriate TrackEdit/ZStackEdit object from database
    project = Project.get_project_by_id(project_id)

    if not project:
        return jsonify({'error': 'project_id not found'}), 404

    state = load_project_state(project)
    filename = state.file.filename

    # Call function in caliban.py to save data file and send to S3 bucket
    if is_trk_file(filename):
        state.action_save_track()
    elif is_npz_file(filename):
        state.action_save_zstack()

    # add "finished" timestamp and null out state longblob
    Project.finish_project(project)

    current_app.logger.debug('Uploaded file "%s" for project "%s" in %s s.',
                             filename, project_id,
                             timeit.default_timer() - start)

    return redirect('/')


@bp.route('/action/<int:project_id>/<action_type>/<int:frame>', methods=['POST'])
def action(project_id, action_type, frame):
    """
    Make an edit operation to the data file and update the object
    in the database.
    """
    start = timeit.default_timer()
    # obtain 'info' parameter data sent by .js script
    info = {k: json.loads(v) for k, v in request.values.to_dict().items()}

    try:
        # Get project and current label frame from database
        project = Project.get_project(project_id)
        # Use project_id and frame to grab row from database
        frame = LabelFrame.get_frame(project_id, frame)

        if not project:
            return jsonify({'error': 'project_id not found'}), 404

        frame = load_frame(frame_row)
        # Perform edit operation on the data file
        state.action(action_type, info)

        x_changed = state._x_changed
        y_changed = state._y_changed
        info_changed = state.info_changed

        state._x_changed = state._y_changed = state.info_changed = False

        # Update object in local database
        LabelFrame.update_frame(project, state)

    except Exception as e:  # TODO: more error handling to identify problem
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

    tracks = state.file.readable_tracks if info_changed else False

    if x_changed or y_changed:
        encode = lambda x: base64.encodebytes(x.read()).decode()
        img_payload = {}

        if x_changed:
            raw = state.get_frame(frame, raw=True)
            img_payload['raw'] = f'data:image/png;base64,{encode(raw)}'
        if y_changed:
            img = state.get_frame(frame, raw=False)
            img_payload['segmented'] = f'data:image/png;base64,{encode(img)}'
            edit_arr = state.get_array(frame)
            img_payload['seg_arr'] = edit_arr.tolist()

    else:
        img_payload = False

    current_app.logger.debug('Action "%s" for project "%s" finished in %s s.',
                             action_type, project_id,
                             timeit.default_timer() - start)

    return jsonify({'tracks': tracks, 'imgs': img_payload})


@bp.route('/frame/<int:frame>/<int:project_id>')
def get_frame(frame, project_id):
    """
    Serve modes of frames as pngs. Send pngs and color mappings of
    cells to .js file.
    """
    start = timeit.default_timer()
    # Get frames from database
    raw_frame = RawFrame.get_frame(project_id, frame)
    label_frame = LabelFrame.get_frame(project_id, frame)

    if not raw_frame or not label_frame:
        return jsonify({'error': 'frame not found'}), 404
    
    # Get metadata from database to draw images (max label and colormap)
    metadata = Metadata.get_metadata(project_id)
    
    # Select current channel/feature
    raw_arr = raw_frame.frame[..., metadata.channel]
    label_arr = label_frame.frame[..., metadata.feature]
    label_arr = add_outlines(label_arr)

    raw_png = pngify(imgarr=raw_arr,
                     vmin=0,
                     vmax=None,
                     cmap='cubehelix')
    label_png = pngify(imgarr=np.ma.masked_equal(label_arr, 0),
                       vmin=0,
                       vmax=metadata.get_max_label(),
                       cmap=metadata.color_map)

    encode = lambda x: base64.encodebytes(x.read()).decode()

    payload = {
        'raw': f'data:image/png;base64,{encode(raw_png)}',
        'segmented': f'data:image/png;base64,{encode(label_png)}',
        'seg_arr': label_arr.tolist()
    }

    current_app.logger.debug('Got frame %s of project "%s" in %s s.',
                             frame, project_id, timeit.default_timer() - start)

    return jsonify(payload)


@bp.route('/load/<filename>', methods=['POST'])
def load(filename):
    """
    Initate TrackEdit/ZStackEdit object and load object to database.
    Send specific attributes of the object to the .js file.
    """
    start = timeit.default_timer()
    current_app.logger.info('Loading track at %s', filename)

    folders = re.split('__', filename)
    filename = folders[len(folders) - 1]
    subfolders = folders[2:len(folders) - 1]

    subfolders = '/'.join(subfolders)
    full_path = os.path.join(subfolders, filename)

    input_bucket = folders[0]
    output_bucket = folders[1]

    # arg is 'false' which gets parsed to True if casting to bool
    rgb = request.args.get('rgb', default='false', type=str)
    rgb = bool(distutils.util.strtobool(rgb))

    if not is_trk_file(filename) and not is_npz_file(filename):
        error = {
            'error': 'invalid file extension: {}'.format(
                os.path.splitext(filename)[-1])
        }
        return jsonify(error), 400

    # Initate Project entry in database
    project = Project.create_project(filename, input_bucket, full_path)
    metadata = project.metadata_

    if is_trk_file(filename):
        current_app.logger.debug('Loaded trk file "%s" in %s s.',
                                 filename, timeit.default_timer() - start)
        # Send attributes to .js file
        return jsonify({
            'max_frames': metadata.numFrames,
            'tracks': metadata.readable_tracks,
            'dimensions': (metadata.width, metadata.height),
            'project_id': project.id,
            'screen_scale': metadata.scale_factor
        })

    if is_npz_file(filename):
        current_app.logger.debug('Loaded npz file "%s" in %s s.',
                                 filename, timeit.default_timer() - start)
        # Send attributes to .js file
        return jsonify({
            'max_frames': metadata.numFrames,
            'channel_max': metadata.numChannels,
            'feature_max': metadata.numFeatures,
            'tracks': metadata.readable_tracks,
            'dimensions': (metadata.width, metadata.height),
            'project_id': project.id
        })


@bp.route('/', methods=['GET', 'POST'])
def form():
    """Request HTML landing page to be rendered."""
    return render_template('index.html')


@bp.route('/tool', methods=['GET', 'POST'])
def tool():
    """
    Request HTML caliban tool page to be rendered after user inputs
    filename in the landing page.
    """
    if 'filename' not in request.form:
        return redirect('/')

    filename = request.form['filename']

    current_app.logger.info('%s is filename', filename)

    # TODO: better name template?
    new_filename = 'caliban-input__caliban-output__test__{}'.format(filename)

    # if no options passed (how this route will be for now),
    # still want to pass in default settings
    rgb = request.args.get('rgb', default='false', type=str)
    pixel_only = request.args.get('pixel_only', default='false', type=str)
    label_only = request.args.get('label_only', default='false', type=str)

    # Using distutils to cast string arguments to bools
    settings = {
        'rgb': bool(distutils.util.strtobool(rgb)),
        'pixel_only': bool(distutils.util.strtobool(pixel_only)),
        'label_only': bool(distutils.util.strtobool(label_only))
    }

    if is_trk_file(new_filename):
        filetype = 'track'
        title = 'Tracking Tool'

    elif is_npz_file(new_filename):
        filetype = 'zstack'
        title = 'Z-Stack Tool'

    else:
        # TODO: render an error template instead of JSON.
        error = {
            'error': 'invalid file extension: {}'.format(
                os.path.splitext(filename)[-1])
        }
        return jsonify(error), 400

    return render_template(
        'tool.html',
        filetype=filetype,
        title=title,
        filename=new_filename,
        settings=settings)


@bp.route('/<filename>', methods=['GET', 'POST'])
def shortcut(filename):
    """
    Request HTML caliban tool page to be rendered if user makes a URL
    request to access a specific data file that has been preloaded to the
    input S3 bucket (ex. http://127.0.0.1:5000/test.npz).
    """
    rgb = request.args.get('rgb', default='false', type=str)
    pixel_only = request.args.get('pixel_only', default='false', type=str)
    label_only = request.args.get('label_only', default='false', type=str)

    settings = {
        'rgb': bool(distutils.util.strtobool(rgb)),
        'pixel_only': bool(distutils.util.strtobool(pixel_only)),
        'label_only': bool(distutils.util.strtobool(label_only))
    }

    if is_trk_file(filename):
        filetype = 'track'
        title = 'Tracking Tool'

    elif is_npz_file(filename):
        filetype = 'zstack'
        title = 'Z-Stack Tool'

    else:
        # TODO: render an error template instead of JSON.
        error = {
            'error': 'invalid file extension: {}'.format(
                os.path.splitext(filename)[-1])
        }
        return jsonify(error), 400

    return render_template(
        'tool.html',
        filetype=filetype,
        title=title,
        filename=filename,
        settings=settings)


def get_edit(file_, output_bucket, rgb):
    """Factory for Edit objects"""
    if is_npz_file(file_.filename):
        return ZStackEdit(file_, output_bucket, rgb)
    elif is_trk_file(file_.filename):
        # don't use RGB mode with track files
        return TrackEdit(file_, output_bucket)
    return BaseEdit(file_, output_bucket)
