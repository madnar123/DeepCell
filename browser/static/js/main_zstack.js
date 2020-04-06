class Mode {
  constructor(kind, info) {
    this.kind = kind;
    this.info = info;
    this.highlighted_cell_one = -1;
    this.highlighted_cell_two = -1;
    this.feature = 0;
    this._channel = 0;
    this.action = "";
    this.prompt = "";

  }

  get channel() {
    return this._channel;
  }

  set channel(num) {
    // don't try and change channel if no other channels exist
    if (channel_max > 1) {
      // save current display settings before changing
      brightnessMap.set(this._channel, brightness);
      contrastMap.set(this._channel, current_contrast);
      // change channel, wrap around if needed
      if (num === channel_max) {
        this._channel = 0;
      } else if (num < 0) {
        this._channel = channel_max - 1;
      } else {
        this._channel = num;
      }
      // get new channel image from server
      this.info = {"channel": this._channel};
      action("change_channel", this.info);
      this.clear();
      // get brightness/contrast vals for new channel
      brightness = brightnessMap.get(this._channel);
      current_contrast = contrastMap.get(this._channel);
    }
  }

  clear() {
    this.kind = Modes.none;
    this.info = {};
    this.highlighted_cell_one = -1;
    this.highlighted_cell_two = -1;

    brush.conv = false;
    brush.clearThresh();
    update_seg_highlight();

    this.action = "";
    this.prompt = "";
    render_image_display();
  }

  // these keybinds apply regardless of
  // edit_mode, mode.action, or mode.kind
  handle_universal_keybind(key) {
    if (key === 'a' || key === 'ArrowLeft') {
      // go backward one frame
      current_frame -= 1;
      if (current_frame < 0) {
        current_frame = max_frames - 1;
      }
      fetch_and_render_frame();
    } else if (key === 'd' || key === 'ArrowRight') {
      // go forward one frame
      current_frame += 1;
      if (current_frame >= max_frames) {
        current_frame = 0;
      }
      fetch_and_render_frame();
    } else if (key === "Escape") {
      // deselect/cancel action/reset highlight
      mode.clear();
      // may want some things here that trigger on ESC but not clear()
    } else if (key === 'h') {
      // toggle highlight
      current_highlight = !current_highlight;
      render_image_display();
    } else if (key === 'z') {
      // toggle rendering_raw
      rendering_raw = !rendering_raw;
      render_image_display();
    } else if (key === '0') {
      // reset brightness adjustments
      brightness = 0;
      current_contrast = 0;
      render_image_display();
    } else if (key === 'l' && !edit_mode) {
      display_labels = !display_labels;
      render_image_display();
    }
  }

  // keybinds that always apply in edit mode
  // (invert, change brush size)
  handle_universal_edit_keybind(key) {
    if (key === "ArrowDown") {
      // decrease brush size, minimum size 1
      brush.size -= 1;
      // redraw the frame with the updated brush preview
      render_image_display();
    } else if (key === "ArrowUp") {
      // increase brush size, diameter shouldn't be larger than the image
      brush.size += 1;
      // redraw the frame with the updated brush preview
      render_image_display();
    } else if (key === 'i') {
      // toggle light/dark inversion of raw img
      display_invert = !display_invert;
      render_image_display();
    } else if (key === 'n') {
      // set edit value to something unused
      brush.value = maxLabelsMap.get(this.feature) + 1;
      update_seg_highlight();
      if (this.kind === Modes.prompt && brush.conv) {
        this.prompt = "Now drawing over label " + brush.target + " with label " + brush.value
            + ". Use ESC to leave this mode.";
        this.kind = Modes.drawing;
        render_image_display();
      }
      render_info_display();
    }
  }

  // keybinds that apply when in edit mode
  handle_edit_keybind(key) {
    if (key === "e" && !settings.pixel_only) {
      // toggle edit mode
      edit_mode = !edit_mode;
      render_image_display();
    } else if (key === "c") {
      // cycle forward one channel, if applicable
      this.channel += 1;
    } else if (key === "C") {
      // cycle backward one channel, if applicable
      this.channel -= 1;
    } else if (key === "f") {
      // cycle forward one feature, if applicable
      if (feature_max > 1) {
        this.feature = this.increment_value(this.feature, 0, feature_max -1);
        this.info = {"feature": this.feature};
        action("change_feature", this.info);
        this.clear();
      }
    } else if (key === "F") {
      // cycle backward one feature, if applicable
      if (feature_max > 1) {
        this.feature = this.decrement_value(this.feature, 0, feature_max -1);
        this.info = {"feature": this.feature};
        action("change_feature", this.info);
        this.clear();
      }
    } else if (key === "=") {
      // increase edit_value up to max label + 1 (guaranteed unused)
      brush.value = Math.min(brush.value + 1,
          maxLabelsMap.get(this.feature) + 1);
      update_seg_highlight();
      render_info_display();
    } else if (key === "-") {
      // decrease edit_value, minimum 1
      brush.value -= 1;
      update_seg_highlight();
      render_info_display();
    } else if (key === "x") {
      // turn eraser on and off
      brush.erase = !brush.erase;
      render_image_display();
    } else if (key === 'p') {
      // color picker
      this.kind = Modes.prompt;
      this.action = "pick_color";
      this.prompt = "Click on a label to change the brush value to that value.";
      render_info_display();
    } else if (key === 'r') {
      // conversion brush
      this.kind = Modes.prompt;
      this.action = "pick_target";
      this.prompt = "First, click on the label you want to overwrite.";
      brush.conv = true;
      render_image_display();
    } else if (key === 't' && !rgb) {
      // prompt thresholding with bounding box
      this.kind = Modes.question;
      this.action = "start_threshold";
      this.prompt = "Click and drag to create a bounding box around the area you want to threshold";
      brush.show = false;
      brush.clearView();
      render_image_display();
    }
  }

  // keybinds that apply in bulk mode, nothing selected
  handle_mode_none_keybind(key) {
    if (key === "e" && !settings.label_only) {
      // toggle edit mode
      edit_mode = !edit_mode;
      helper_brush_draw();
      render_image_display();
    } else if (key === "c") {
      // cycle forward one channel, if applicable
      this.channel += 1;
    } else if (key === "C") {
      // cycle backward one channel, if applicable
      this.channel -= 1;
    } else if (key === "f") {
      // cycle forward one feature, if applicable
      if (feature_max > 1) {
        this.feature = this.increment_value(this.feature, 0, feature_max -1);
        this.info = {"feature": this.feature};
        action("change_feature", this.info);
        this.clear();
      }
    } else if (key === "F") {
      // cycle backward one feature, if applicable
      if (feature_max > 1) {
        this.feature = this.decrement_value(this.feature, 0, feature_max -1);
        this.info = {"feature": this.feature};
        action("change_feature", this.info);
        this.clear();
      }
    } else if (key === "p" && !rgb) {
      //iou cell identity prediction
      this.kind = Modes.question;
      this.action = "predict";
      this.prompt = "Predict cell ids for zstack? / S=PREDICT THIS FRAME / SPACE=PREDICT ALL FRAMES / ESC=CANCEL PREDICTION";
      render_info_display();
    } else if (key === "-" && this.highlighted_cell_one !== -1) {
      // cycle highlight to prev label
      this.highlighted_cell_one = this.decrement_value(this.highlighted_cell_one,
          1, maxLabelsMap.get(this.feature));
      render_image_display();
    } else if (key === "=" && this.highlighted_cell_one !== -1) {
      // cycle highlight to next label
      this.highlighted_cell_one = this.increment_value(this.highlighted_cell_one,
          1, maxLabelsMap.get(this.feature));
      render_image_display();
    }
  }

  // keybinds that apply in bulk mode, one selected
  handle_mode_single_keybind(key) {
    if (key === "f") {
      //hole fill
      this.info = { "label": this.info.label,
                    "frame": current_frame};
      this.kind = Modes.prompt;
      this.action = "fill_hole";
      this.prompt = "Select hole to fill in cell " + this.info.label;
      render_info_display();
    } else if (key === "c") {
      // create new
      this.kind = Modes.question;
      this.action = "create_new";
      this.prompt = "CREATE NEW(S=SINGLE FRAME / SPACE=ALL SUBSEQUENT FRAMES / ESC=NO)";
      render_info_display();
    } else if (key === "x") {
      // delete label from frame
      this.kind = Modes.question;
      this.action = "delete";
      this.prompt = "delete label " + this.info.label + " in frame " + this.info.frame + "? " + answer;
      render_info_display();
    } else if (key === "-") {
      // cycle highlight to prev label
      this.highlighted_cell_one = this.decrement_value(this.highlighted_cell_one,
          1, maxLabelsMap.get(this.feature));
      // clear info but show new highlighted cell
      let temp_highlight = this.highlighted_cell_one;
      this.clear();
      this.highlighted_cell_one = temp_highlight;
      render_image_display();
    } else if (key === "=") {
      // cycle highlight to next label
      this.highlighted_cell_one = this.increment_value(this.highlighted_cell_one,
          1, maxLabelsMap.get(this.feature));
      // clear info but show new highlighted cell
      let temp_highlight = this.highlighted_cell_one;
      this.clear();
      this.highlighted_cell_one = temp_highlight;
      render_image_display();
    }
  }

  // keybinds that apply in bulk mode, two selected
  handle_mode_multiple_keybind(key) {
    if (key === "r") {
      // replace
      this.kind = Modes.question;
      this.action = "replace";
      this.prompt = ("Replace " + this.info.label_2 + " with " + this.info.label_1 +
        "? // SPACE = Replace in all frames / S = Replace in this frame only / ESC = Cancel replace");
      render_info_display();
    } else if (key === "s") {
      // swap
      this.kind = Modes.question;
      this.action = "swap_cells";
      this.prompt = "SPACE = SWAP IN ALL FRAMES / S = SWAP IN THIS FRAME ONLY / ESC = CANCEL SWAP";
      render_info_display();
    } else if (key === "w" && !rgb) {
      // watershed
      this.kind = Modes.question;
      this.action = "watershed";
      this.prompt = "Perform watershed to split " + this.info.label_1 + "? " + answer;
      render_info_display();
    }
  }

  // keybinds that apply in bulk mode, answering question/prompt
  handle_mode_question_keybind(key) {
    if (key === " ") {
      if (this.action === "flood_cell") {
        action("flood_cell", this.info);
      } else if (this.action === "trim_pixels") {
        action("trim_pixels", this.info);
      } else if (this.action === "create_new") {
        action("new_cell_stack", this.info);
      } else if (this.action === "delete") {
        action("delete", this.info);
      } else if (this.action === "predict") {
        action("predict_zstack", this.info);
      } else if (this.action === "replace") {
        if (this.info.label_1 !== this.info.label_2) {
          let send_info = {"label_1": this.info.label_1,
                          "label_2": this.info.label_2};
          action("replace", send_info);
        }
      } else if (this.action === "swap_cells") {
        if (this.info.label_1 !== this.info.label_2) {
          let send_info = {"label_1": this.info.label_1,
                          "label_2": this.info.label_2};
          action("swap_all_frame", send_info);
        }
      } else if (this.action === "watershed") {
        if (this.info.label_1 === this.info.label_2 &&
            this.info.frame_1 === this.info.frame_2) {
          this.info.frame = this.info.frame_1;
          this.info.label = this.info.label_1;
          delete this.info.frame_1;
          delete this.info.frame_2;
          delete this.info.label_1;
          delete this.info.label_2;
          action(this.action, this.info);
        }
      }
      this.clear();
    } else if (key === "s") {
      if(this.action === "create_new") {
        action("new_single_cell", this.info);
      } else if (this.action === "predict") {
        action("predict_single", {"frame": current_frame});
      } else if (this.action === "replace") {
        if (this.info.label_1 !== this.info.label_2 &&
            this.info.frame_1 === this.info.frame_2) {
          let send_info = {"label_1": this.info.label_1,
                            "label_2": this.info.label_2,
                            "frame": this.info.frame_1};
          action("replace_single", send_info);
        }
      } else if (this.action === "swap_cells") {
        if (this.info.label_1 !== this.info.label_2 &&
            this.info.frame_1 === this.info.frame_2) {
          let send_info = {"label_1": this.info.label_1,
                            "label_2": this.info.label_2,
                            "frame": this.info.frame_1};
          action("swap_single_frame", send_info);
        }
      }
      this.clear();
    }
  }

  // handle all keypresses
  handle_key(key) {
    // universal keybinds always apply
    // keys a, d, left arrow, right arrow, ESC, h
    // are reserved for universal keybinds
    this.handle_universal_keybind(key);
    if (edit_mode) {
      this.handle_universal_edit_keybind(key);
    }
    if (edit_mode && this.kind === Modes.none) {
      this.handle_edit_keybind(key);
    } else if (!edit_mode && this.kind === Modes.none) {
      this.handle_mode_none_keybind(key);
    } else if (!edit_mode && this.kind === Modes.single) {
      this.handle_mode_single_keybind(key);
    } else if (!edit_mode && this.kind === Modes.multiple) {
      this.handle_mode_multiple_keybind(key);
    } else if (!edit_mode && this.kind === Modes.question) {
      this.handle_mode_question_keybind(key);
    }
  }

  handle_draw() {
    action("handle_draw", { "trace": JSON.stringify(mouse_trace), //stringify array so it doesn't get messed up
                  "target_value": brush.target, //value that we're overwriting
                  "brush_value": brush.value, //we don't update caliban with edit_value, etc each time they change
                  "brush_size": brush.size, //so we need to pass them in as args
                  "erase": (brush.erase && !brush.conv),
                  "frame": current_frame});
    mouse_trace = [];
    if (this.kind !== Modes.drawing) {
      this.clear();
    }
  }

  handle_threshold(evt) {
    let end_y = evt.offsetY - padding;
    let end_x = evt.offsetX - padding;

    let threshold_start_y = Math.floor(brush.threshY / scale);
    let threshold_start_x = Math.floor(brush.threshX / scale);
    let threshold_end_y = Math.floor(end_y / scale);
    let threshold_end_x = Math.floor(end_x / scale);

    if (threshold_start_y !== threshold_end_y &&
        threshold_start_x !== threshold_end_x) {

      action("threshold", {"y1": threshold_start_y,
                          "x1": threshold_start_x,
                          "y2": threshold_end_y,
                          "x2": threshold_end_x,
                          "frame": current_frame,
                          "label": maxLabelsMap.get(this.feature) + 1});
    }
    this.clear();
    render_image_display();
  }

  // helper function to increment value but cycle around if needed
  increment_value(currentValue, minValue, maxValue) {
    if (currentValue < maxValue) {
      currentValue += 1;
    } else {
      currentValue = minValue;
    }
    return currentValue;
  }

  // helper function to decrement value but cycle around if needed
  decrement_value(currentValue, minValue, maxValue) {
    if (currentValue > minValue) {
      currentValue -= 1;
    } else {
      currentValue = maxValue;
    }
    return currentValue;
  }

  handle_mode_none_click(evt) {
    if (evt.altKey) {
      // alt+click
      this.kind = Modes.question;
      this.action = "flood_cell";
      this.info = {"label": current_label,
                        "frame": current_frame,
                        "x_location": mouse_x,
                        "y_location": mouse_y};
      this.prompt = "SPACE = FLOOD SELECTED CELL WITH NEW LABEL / ESC = CANCEL";
      this.highlighted_cell_one = current_label;
    } else if (evt.shiftKey) {
      // shift+click
      this.kind = Modes.question;
      this.action = "trim_pixels";
      this.info = {"label": current_label,
                        "frame": current_frame,
                        "x_location": mouse_x,
                        "y_location": mouse_y};
      this.prompt = "SPACE = TRIM DISCONTIGUOUS PIXELS FROM CELL / ESC = CANCEL";
      this.highlighted_cell_one = current_label;
    } else {
      // normal click
      this.kind = Modes.single;
      this.info = { "label": current_label,
                    "frame": current_frame };
      this.highlighted_cell_one = current_label;
      this.highlighted_cell_two = -1;
      temp_x = mouse_x;
      temp_y = mouse_y;
    }
  }

  handle_mode_prompt_click(evt) {
    if (this.action === "fill_hole" && current_label === 0) {
      this.info = { "label": this.info.label,
                    "frame": current_frame,
                    "x_location": mouse_x,
                    "y_location": mouse_y };
      action(this.action, this.info);
      this.clear();
    } else if (this.action === "pick_color"
          && current_label !== 0
          && current_label !== brush.target) {
      brush.value = current_label;
      update_seg_highlight();
      if (brush.target !== 0) {
        this.prompt = "Now drawing over label " + brush.target + " with label " + brush.value
            + ". Use ESC to leave this mode.";
        this.kind = Modes.drawing;
        render_image_display();
      } else {
        this.clear();
      }
    } else if (this.action === "pick_target" && current_label !== 0) {
      brush.target = current_label;
      this.action = "pick_color";
      this.prompt = "Click on the label you want to draw with, or press 'n' to draw with an unused label.";
      render_info_display();
    }
  }

  handle_mode_single_click(evt) {
    this.kind = Modes.multiple;

    this.highlighted_cell_one = this.info.label;
    this.highlighted_cell_two = current_label;

    this.info = { "label_1": this.info.label,
                  "label_2": current_label,
                  "frame_1": this.info.frame,
                  "frame_2": current_frame,
                  "x1_location": temp_x,
                  "y1_location": temp_y,
                  "x2_location": mouse_x,
                  "y2_location": mouse_y };
  }

  handle_mode_multiple_click(evt) {
    this.highlighted_cell_one = this.info.label_1;
    this.highlighted_cell_two = current_label;

    this.info = {"label_1": this.info.label_1,
                "label_2": current_label,
                "frame_1": this.info.frame_1,
                "frame_2": current_frame,
                "x1_location": temp_x,
                "y1_location": temp_y,
                "x2_location": mouse_x,
                "y2_location": mouse_y};
  }

  click(evt) {
    if (this.kind === Modes.prompt) {
      // hole fill or color picking options
      this.handle_mode_prompt_click(evt);
    } else if (current_label === 0) {
      // same as ESC
      this.clear();
      return; //not sure why we return here
    } else if (this.kind === Modes.none) {
      //if nothing selected: shift-, alt-, or normal click
      this.handle_mode_none_click(evt);
      render_image_display();
    } else if (this.kind === Modes.single) {
      // one label already selected
      this.handle_mode_single_click(evt);
      render_image_display();
    } else if (this.kind  === Modes.multiple) {
      // two labels already selected, reselect second label
      this.handle_mode_multiple_click(evt);
      render_image_display();
    }
  }

  //shows up in info display as text for "state:"
  render() {
    if (this.kind === Modes.none) {
      return "";
    }
    if (this.kind === Modes.single) {
      return "SELECTED " + this.info.label;
    }
    if (this.kind === Modes.multiple) {
      return "SELECTED " + this.info.label_1 + ", " + this.info.label_2;
    }
    if (this.kind === Modes.question || this.kind === Modes.prompt || this.kind === Modes.drawing) {
      return this.prompt;
    }
  }
}

var Modes = Object.freeze({
  "none": 1,
  "single": 2,
  "multiple": 3,
  "question": 4,
  "info": 5,
  "prompt": 6,
  "drawing": 7
});

let rgb;
var temp_x = 0;
var temp_y = 0;
var rendering_raw = false;
let display_invert = true;
let display_labels = false;
var current_contrast;
let contrastMap = new Map();
let brightness;
let brightnessMap = new Map();
var current_frame = 0;
var current_label = 0;
var current_highlight = false;
var max_frames;
var feature_max;
var channel_max;
var dimensions;
var tracks;
let maxLabelsMap = new Map();
var mode = new Mode(Modes.none, {});
var raw_image = new Image();
raw_image.onload = render_image_display;
var seg_image = new Image();
seg_image.onload = update_seg_highlight;
var seg_array; // declare here so it is global var
var scale;
var mouse_x = 0;
var mouse_y = 0;
const padding = 5;
let edit_mode;
var answer = "(SPACE=YES / ESC=NO)";
let mousedown = false;
var tooltype = 'draw';
var project_id;
var brush;
let mouse_trace = [];
const adjusted_seg = new Image();
adjusted_seg.onload = render_image_display;

function upload_file() {
  $.ajax({
    type:'POST',
    url:"upload_file/" + project_id,
    success: function (payload) {
    },
    async: false
  });
}


function label_under_mouse() {
  let img_y = Math.floor(mouse_y/scale);
  let img_x = Math.floor(mouse_x/scale);
  let new_label;
  if (img_y >= 0 && img_y < seg_array.length &&
      img_x >= 0 && img_x < seg_array[0].length) {
    new_label = Math.abs(seg_array[img_y][img_x]); //check array value at mouse location
  } else {
    new_label = 0;
  }
  return new_label;
}

function render_highlight_info() {
  if (current_highlight) {
    $('#highlight').html("ON");
    if (edit_mode) {
      if (brush.value > 0) {
        $('#currently_highlighted').html(brush.value)
      } else {
        $('#currently_highlighted').html('-')
      }
    } else {
      if (mode.highlighted_cell_one !== -1) {
        if (mode.highlighted_cell_two !== -1) {
          $('#currently_highlighted').html(mode.highlighted_cell_one + " , " + mode.highlighted_cell_two);
        } else {
          $('#currently_highlighted').html(mode.highlighted_cell_one);
        }
      } else {
        $('#currently_highlighted').html("none");
      }
    }
  } else {
    $('#highlight').html("OFF");
    $('#currently_highlighted').html("none");
  }
}

function render_edit_info() {
  if (edit_mode) {
    $('#edit_mode').html("ON");
    $('#edit_brush_row').css('visibility', 'visible');
    $('#edit_label_row').css('visibility', 'visible');
    $('#edit_erase_row').css('visibility', 'visible');

    $('#edit_brush').html(brush.size);
    if (brush.value > 0) {
      $('#edit_label').html(brush.value);
    } else {
      $('#edit_label').html('-');
    }

    if (brush.erase && !brush.conv) {
      $('#edit_erase').html("ON");
    } else {
      $('#edit_erase').html("OFF");
    }

  } else {
    $('#edit_mode').html("OFF");
    $('#edit_brush_row').css('visibility', 'hidden');
    $('#edit_label_row').css('visibility', 'hidden');
    $('#edit_erase_row').css('visibility', 'hidden');
  }
}

function render_cell_info() {
  current_label = label_under_mouse();
  if (current_label !== 0) {
    $('#label').html(current_label);
    let track = tracks[mode.feature][current_label.toString()];
    $('#slices').text(track.slices.toString());
  } else {
    $('#label').html("");
    $('#slices').text("");
  }
}

// updates html display of side info panel
function render_info_display() {
  // always show current frame, feature, channel
  $('#frame').html(current_frame);
  $('#feature').html(mode.feature);
  $('#channel').html(mode.channel);

  render_highlight_info();

  render_edit_info();

  render_cell_info();

  // always show 'state'
  $('#mode').html(mode.render());
}

function render_edit_image(ctx) {
  let redOutline, r1, singleOutline, o1, outlineAll, translucent, t1, t2;
  if (rgb) {
    render_raw_image(ctx);
    let img_data = ctx.getImageData(padding, padding, dimensions[0], dimensions[1]);
    // red outline for conversion brush target
    if (edit_mode && brush.conv && brush.target !== -1) {
      redOutline = true;
      r1 = brush.target;
    }
    outlineAll = true;
    // translucent highlight
    if (current_highlight) {
      translucent = true;
      t1 = brush.value;
    }
    postCompositeLabelMod(img_data, redOutline, r1, singleOutline, o1,
      outlineAll, translucent, t1, t2);
    ctx.putImageData(img_data, padding, padding);

  } else {
    ctx.clearRect(padding, padding, dimensions[0], dimensions[1]);
    ctx.drawImage(raw_image, padding, padding, dimensions[0], dimensions[1]);
    let raw_image_data = ctx.getImageData(padding, padding, dimensions[0], dimensions[1]);

    // adjust underlying raw image
    contrast_image(raw_image_data, current_contrast, brightness);
    grayscale(raw_image_data);
    if (display_invert) {
      invert(raw_image_data);
    }
    ctx.putImageData(raw_image_data, padding, padding);

    // draw segmentations, highlighted version if highlight is on
    ctx.save();
    // ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = 0.3;
    if (current_highlight) {
      ctx.drawImage(adjusted_seg, padding, padding, dimensions[0], dimensions[1]);
    } else {
      ctx.drawImage(seg_image, padding, padding, dimensions[0], dimensions[1]);
    }
    ctx.restore();

    // add outlines around conversion brush target/value
    let img_data = ctx.getImageData(padding, padding, dimensions[0], dimensions[1]);
    // red outline for conversion brush target
    if (edit_mode && brush.conv && brush.target !== -1) {
      redOutline = true;
      r1 = brush.target;
    }
    if (edit_mode && brush.conv && brush.value !== -1) {
      singleOutline = true;
      o1 = brush.value;
    }

    postCompositeLabelMod(img_data, redOutline, r1, singleOutline, o1,
      outlineAll, translucent, t1, t2);
    ctx.putImageData(img_data, padding, padding);
  }

  // draw brushview on top of cells/annotations
  brush.draw(ctx);
}

function render_raw_image(ctx) {
  ctx.clearRect(padding, padding, dimensions, dimensions[1]);
  ctx.drawImage(raw_image, padding, padding, dimensions[0], dimensions[1]);

  // contrast image
  image_data = ctx.getImageData(padding, padding, dimensions[0], dimensions[1]);
  contrast_image(image_data, current_contrast, brightness);
  // draw contrasted image over the original
  ctx.putImageData(image_data, padding, padding);
}

function render_annotation_image(ctx) {
  if (rgb && !display_labels) {
    let redOutline, r1, singleOutline, o1, outlineAll, translucent, t1, t2;
    render_raw_image(ctx);
    let img_data = ctx.getImageData(padding, padding, dimensions[0], dimensions[1]);
    outlineAll = true;
    // translucent highlight
    if (current_highlight) {
      translucent = true;
      t1 = mode.highlighted_cell_one;
      t2 = mode.highlighted_cell_two;
    }
    postCompositeLabelMod(img_data, redOutline, r1, singleOutline, o1,
      outlineAll, translucent, t1, t2);
    ctx.putImageData(img_data, padding, padding);
  } else {
    ctx.clearRect(padding, padding, dimensions[0], dimensions[1]);
    ctx.drawImage(seg_image, padding, padding, dimensions[0], dimensions[1]);
    if (current_highlight) {
      let img_data = ctx.getImageData(padding, padding, dimensions[0], dimensions[1]);
      preCompositeLabelMod(img_data, mode.highlighted_cell_one, mode.highlighted_cell_two);
      ctx.putImageData(img_data, padding, padding);
    }
  }
}

function render_image_display() {
  let ctx = $('#canvas').get(0).getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (edit_mode) {
    // edit mode (annotations overlaid on raw + brush preview)
    render_edit_image(ctx);
  } else if (rendering_raw) {
    // draw raw image
    render_raw_image(ctx);
  } else {
    // draw annotations
    render_annotation_image(ctx);
  }
  render_info_display();
}

function fetch_and_render_frame() {
  $.ajax({
    type: 'GET',
    url: "frame/" + current_frame + "/" + project_id,
    success: function(payload) {
      // load new value of seg_array
      // array of arrays, contains annotation data for frame
      seg_array = payload.seg_arr;
      seg_image.src = payload.segmented;
      raw_image.src = payload.raw;
    },
    async: false
  });
}

function load_file(file) {
  $.ajax({
    type:'POST',
    url:"load/" + file + `?&rgb=${settings.rgb}`,
    success: function (payload) {
      max_frames = payload.max_frames;
      feature_max = payload.feature_max;
      channel_max = payload.channel_max;
      scale = payload.screen_scale;
      dimensions = [scale * payload.dimensions[0], scale * payload.dimensions[1]];

      tracks = payload.tracks; //tracks payload is dict

      //for each feature, get list of cell labels that are in that feature
      //(each is a key in that dict), cast to numbers, then get the maximum
      //value from each array and store it in a map
      for (let i = 0; i < Object.keys(tracks).length; i++){
        let key = Object.keys(tracks)[i]; //the keys are strings
        //use i as key in this map because it is an int, mode.feature is also int
        maxLabelsMap.set(i, Math.max(... Object.keys(tracks[key]).map(Number)));
      }

      for (let i = 0; i < channel_max; i++) {
        brightnessMap.set(i, 0);
        contrastMap.set(i, 0);
      }
      brightness = brightnessMap.get(0);
      current_contrast = contrastMap.get(0);

      project_id = payload.project_id;
      $('#canvas').get(0).width = dimensions[0] + 2*padding;
      $('#canvas').get(0).height = dimensions[1] + 2*padding;
      $('#hidden_seg_canvas').get(0).width = dimensions[0];
      $('#hidden_seg_canvas').get(0).height = dimensions[1];
    },
    async: false
  });
}

// adjust current_contrast upon mouse scroll
function handle_scroll(evt) {
  // adjust contrast whenever we can see raw
  if ((rendering_raw || edit_mode) && !evt.originalEvent.shiftKey) {
    // don't use magnitude of scroll
    let mod_contrast = -Math.sign(evt.originalEvent.deltaY) * 4;
    // stop if fully desaturated
    current_contrast = Math.max(current_contrast + mod_contrast, -100);
    // stop at 5x contrast
    current_contrast = Math.min(current_contrast + mod_contrast, 400);
    render_image_display();
  } else if ((rendering_raw || edit_mode) && evt.originalEvent.shiftKey) {
    let mod = -Math.sign(evt.originalEvent.deltaY);
    brightness = Math.min(brightness + mod, 255);
    brightness = Math.max(brightness + mod, -512);
    render_image_display();
  }
}

// handle pressing mouse button (treats this as the beginning
// of click&drag, since clicks are handled by Mode.click)
function handle_mousedown(evt) {
  if (mode.kind !== Modes.prompt) {
    mousedown = true;
    mouse_x = evt.offsetX - padding;
    mouse_y = evt.offsetY - padding;
    // begin drawing
    if (edit_mode) {
      let img_y = Math.floor(mouse_y/scale);
      let img_x = Math.floor(mouse_x/scale);
      if (!brush.show) {
        brush.threshX = mouse_x;
        brush.threshY = mouse_y;
      } else {
        mouse_trace.push([img_y, img_x]);
      }
    }
  }
}

function helper_brush_draw() {
  if (mousedown) {
    // update mouse_trace
    let img_y = Math.floor(mouse_y/scale);
    let img_x = Math.floor(mouse_x/scale);
    mouse_trace.push([img_y, img_x]);
  } else {
    brush.clearView();
  }
  brush.addToView();
}

// handles mouse movement, whether or not mouse button is held down
function handle_mousemove(evt) {
  // update displayed info depending on where mouse is
  mouse_x = evt.offsetX - padding;
  mouse_y = evt.offsetY - padding;
  render_info_display();

  // keeps brush location updated correctly when mouse moves outside edit mode
  brush.x = mouse_x;
  brush.y = mouse_y;

  // update brush preview
  if (edit_mode) {
    // brush's canvas is keeping track of the brush
    if (brush.show) {
      helper_brush_draw();
    } else {
      brush.boxView();
    }
    render_image_display();
  }
}

// handles end of click&drag (different from click())
function handle_mouseup(evt) {
  if (mode.kind !== Modes.prompt) {
    mousedown = false;
    if (edit_mode) {
      if (!brush.show) {
        mode.handle_threshold(evt);
      } else {
        //send click&drag coordinates to caliban.py to update annotations
        mode.handle_draw();
      }
      // reset brush preview
      brush.x = evt.offsetX - padding;
      brush.y = evt.offsetY - padding;
      brush.refreshView();
    }
  }
}

function prepare_canvas() {
  // bind click on canvas
  $('#canvas').click(function(evt) {
    if (!edit_mode || mode.kind === Modes.prompt) {
      mode.click(evt);
    }
  });
  // bind scroll wheel
  $('#canvas').on('wheel', function(evt) {
    // adjusts contrast of raw when scrolled
    handle_scroll(evt);
  });
  // mousedown for click&drag/handle_draw DIFFERENT FROM CLICK
  $('#canvas').mousedown(function(evt) {
    handle_mousedown(evt);
  });
  // bind mouse movement
  $('#canvas').mousemove(function(evt) {
    // handle brush preview
    handle_mousemove(evt);
  });
  // bind mouse button release (end of click&drag)
  $('#canvas').mouseup(function(evt) {
    handle_mouseup(evt);
  });
  // bind keypress
  window.addEventListener('keydown', function(evt) {
    mode.handle_key(evt.key);
  }, false);
}

function action(action, info, frame = current_frame) {
  $.ajax({
    type:'POST',
    url:"action/" + project_id + "/" + action + "/" + frame,
    data: info,
    success: function (payload) {
      if (payload.error) {
        alert(payload.error);
      }
      if (payload.imgs) {
        // load new value of seg_array
        // array of arrays, contains annotation data for frame
        seg_array = payload.imgs.seg_arr;

        seg_image.src = payload.imgs.segmented;
        raw_image.src = payload.imgs.raw;
      }
      if (payload.tracks) {
        tracks = payload.tracks;
      //update maxLabelsMap when we get new track info
        for (let i = 0; i < Object.keys(tracks).length; i++){
          let key = Object.keys(tracks)[i]; //the keys are strings
          maxLabelsMap.set(i, Math.max(... Object.keys(tracks[key]).map(Number)));
        }
      }
      if (payload.tracks || payload.imgs) {
        render_image_display();
      }
    },
    async: false
  });
}

function start_caliban(filename) {
  if (settings.pixel_only && !settings.label_only) {
    edit_mode = true;
  } else {
    edit_mode = false;
  }
  rgb = settings.rgb;
  // disable scrolling from scrolling around on page (it should just control brightness)
  document.addEventListener('wheel', function(event) {
    event.preventDefault();
  }, {passive: false});
  // disable space and up/down keys from moving around on page
  $(document).on('keydown', function(event) {
    if (event.key === " ") {
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
    }
  });
  load_file(filename);
  prepare_canvas();
  fetch_and_render_frame();

  brush = new Brush(scale=scale, height=dimensions[1], width=dimensions[0], pad = padding);
  update_seg_highlight();
}