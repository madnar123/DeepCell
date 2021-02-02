import { View } from './view.js';
import { ImageAdjuster } from './adjust.js';
import { CanvasPosition } from './canvas.js';
import { Brush } from './brush.js';
import { SelectedLabels } from './select.js';

export class Model {
  constructor(project) {
    // Dynamic project attributes
    this._frame = project.frame;
    this._feature = project.feature;
    this._channel = project.channel;

    // Booleans
    this._highlight = true;
    this.rgb = false;
    this._display_labels = true; // is true the right default value?

    // Static project attributes
    this.numFrames = project.numFrames;
    this.numFeatures = project.numFeatures;
    this.numChannels = project.numChannels;
    this.projectID = project.project_id;
    this.width = project.dimensions[0];
    this.height = project.dimensions[1];
    this.padding = 5;
    this.scale = 1;

    // Project data (images and label metadata)
    this._rawImage = new Image();
    this._segImage = new Image();
    // array of arrays, contains annotation data for frame
    this._segArray = null;
    this._tracks = project.tracks;
    this.maxLabelsMap = new Map();
    this.processMaxLabels();

    // Control booleans
    this.onCanvas;

    // Model objects
    this.adjuster = new ImageAdjuster(this);
    this.canvas = new CanvasPosition(this);
    this.brush = new Brush(this);
    this.selected = new SelectedLabels(this);

    // TODO: use Observable interface instead and allow any Observer to register
    // only observer right now is the view
    this.view = new View(this);

    // Load images and seg_array from payload
    this.segArray = project.imgs.seg_arr;
    this.segImage = project.imgs.segmented;
    this.rawImage = project.imgs.raw;
  }

  get segArray() {
    return this._segArray;
  }

  set segArray(newSegArray) {
    this._segArray = newSegArray;
    this.canvas.updateLabel();
  }

  get segImage() {
    return this._segImage;
  }

  set segImage(newSegImage) {
    this._segImage = newSegImage;
    this.adjuster.segLoaded = false;
    this.adjuster.segImage.src = newSegImage;
  }

  get rawImage() {
    return this._rawImage;
  }

  set rawImage(newRawImage) {
    this._rawImage = newRawImage;
    this.adjuster.rawLoaded = false;
    this.adjuster.rawImage.src = newRawImage;
  }

  // Model attributes in infopane
  get frame() {
    return this._frame;
  }

  set frame(value) {
    this._frame = value;
    this.notifyInfoChange();
  }

  get feature() {
    return this._feature;
  }

  set feature(value) {
    this._feature = value;
    this.notifyInfoChange();
  }

  get channel() {
    return this._channel;
  }

  set channel(value) {
    // save current display settings before changing
    this.adjuster.brightnessMap.set(this._channel, this.adjuster.brightness);
    this.adjuster.contrastMap.set(this._channel, this.adjuster.contrast);
    this.adjuster.invertMap.set(this._channel, this.adjuster.displayInvert);
    // get brightness/contrast vals for new channel
    this.adjuster.brightness = this.adjuster.brightnessMap.get(value);
    this.adjuster.contrast = this.adjuster.contrastMap.get(value);
    this.adjuster.displayInvert = this.adjuster.invertMap.get(value);

    this.clear();
    this._channel = value;
    this.notifyInfoChange();
  }

  get highlight() {
    return this._highlight;
  }

  set highlight(value) {
    this._highlight = value;
    this.notifyImageFormattingChange();
  }

  get display_labels() {
    return this._display_labels;
  }

  set display_labels(value) {
    this._display_labels = value;
    this.notifyImageChange();
  }

  get tracks() {
    return this._tracks;
  }

  set tracks(value) {
    this._tracks = value;
    this.processMaxLabels();
    this.notifyInfoChange();
  }

  // TODO: use Observable interface instead of hard-coding the view as the only Observer
  notifyImageChange() {
    this.view.canvasView.render();
  }

  notifyImageFormattingChange() {
    this.adjuster.preCompAdjust();
  }

  notifyInfoChange() {
    this.view.infopaneView.render();
  }

  /**
   * Updates maxLabelsMap to match the current tracks.
   */
  processMaxLabels() {
    const tracks = this.tracks;
    for (let i = 0; i < Object.keys(tracks).length; i++) {
      const key = Object.keys(tracks)[i]; // the keys are strings
      if (Object.keys(tracks[key]).length > 0) {
        // use i as key in this map because it is an int, feature is also int
        this.maxLabelsMap.set(i, Math.max(...Object.keys(tracks[key]).map(Number)));
      } else {
        // if no labels in feature, explicitly set max label to 0
        this.maxLabelsMap.set(i, 0);
      }
    }
  }

  handlePayload(payload) {
    if (payload.error) {
      alert(payload.error);
    }

    if (payload.imgs) {
      if (Object.prototype.hasOwnProperty.call(payload.imgs, 'seg_arr')) {
        this.segArray = payload.imgs.seg_arr;
      }
      if (Object.prototype.hasOwnProperty.call(payload.imgs, 'segmented')) {
        this.segImage = payload.imgs.segmented;
      }
      if (Object.prototype.hasOwnProperty.call(payload.imgs, 'raw')) {
        this.rawImage = payload.imgs.raw;
      }
    }

    if (payload.tracks) {
      this.tracks = payload.tracks;
    }
  }

  // deselect/cancel action/reset highlight
  clear() {
    this.selected.clear();
  }

  updateMousePos(x, y) {
    this.canvas.updateCursorPosition(x, y);
  }
}