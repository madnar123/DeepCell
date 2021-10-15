/**
 * Root statechart for DeepCell Label in XState.
 */
import { assign, forwardTo, Machine, send, spawn } from 'xstate';
import { pure } from 'xstate/lib/actions';
import createApiMachine from './apiMachine';
import canvasMachine from './canvasMachine';
import createDatabaseMachine from './databaseMachine';
import createImageMachine from './imageMachine';
import createPyodideMachine from './pyodideMachine';
import selectMachine from './selectMachine';
import segmentMachine from './tools/segmentMachine';
import undoMachine from './undoMachine';

const createProjectMachine = (projectId, bucket) =>
  Machine(
    {
      id: `${projectId}`,
      context: {
        projectId,
        bucket,
        frame: 0,
        feature: 0,
        channel: 0,
      },
      initial: 'setUpActors',
      states: {
        setUpActors: {
          entry: 'spawnActors',
          always: 'setUpUndo',
        },
        setUpUndo: {
          entry: ['spawnUndo', 'addActorsToUndo'],
          always: 'loadingProject',
        },
        loadingProject: {
          on: {
            PROJECT: { target: 'idle', actions: 'forwardProject' },
          },
        },
        idle: {
          initial: 'segment',
          states: {
            segment: {
              on: {
                mouseup: { actions: forwardTo('segment') },
                mousedown: { actions: forwardTo('segment') },
                mousemove: { actions: forwardTo('segment') },
              },
            },
          },
        },
      },
      on: {
        // from various
        ADD_ACTOR: { actions: forwardTo('undo') },
        EDIT: { actions: [forwardTo('pyodide'), forwardTo('undo')] },

        // from image
        FRAME: { actions: 'setFrame' },
        CHANNEL: { actions: 'setChannel' },
        FEATURE: { actions: 'setFeature' },
        GRAYSCALE: { actions: forwardTo('segment') },
        COLOR: { actions: forwardTo('segment') },
        LABELED_ARRAY: { actions: forwardTo('canvas') },
        LABELS: {
          actions: [forwardTo('segment'), forwardTo('select')],
        },

        // from canvas
        LABEL: {
          actions: [forwardTo('segment'), forwardTo('select')],
        },
        COORDINATES: { actions: forwardTo('segment') },
        FOREGROUND: { actions: [forwardTo('segment')] },
        BACKGROUND: { actions: [forwardTo('segment')] },
        SELECTED: { actions: [forwardTo('segment')] },

        // from undo
        BACKEND_UNDO: { actions: forwardTo('api') },
        BACKEND_REDO: { actions: forwardTo('api') },

        // from api
        EDITED: { actions: forwardTo('image') },

        // from tool
        SET_PAN_ON_DRAG: { actions: forwardTo('canvas') },
        SET_FOREGROUND: { actions: forwardTo('select') },
        SELECT_FOREGROUND: { actions: forwardTo('select') },
        SELECT_BACKGROUND: { actions: forwardTo('select') },
        RESET_FOREGROUND: { actions: forwardTo('select') },
      },
    },
    {
      actions: {
        spawnActors: assign({
          canvasRef: () => spawn(canvasMachine, 'canvas'),
          imageRef: context => spawn(createImageMachine(context), 'image'),
          segmentRef: () => spawn(segmentMachine, 'segment'),
          apiRef: context => spawn(createApiMachine(context), 'api'),
          selectRef: () => spawn(selectMachine, 'select'),
          pyodideRef: context => spawn(createPyodideMachine(context), 'pyodide'),
          databaseRef: context => spawn(createDatabaseMachine(context), 'database'),
        }),
        spawnUndo: assign({
          undoRef: () => spawn(undoMachine, 'undo'),
        }),
        addActorsToUndo: pure(context => {
          const { canvasRef, segmentRef, imageRef } = context;
          return [
            send({ type: 'ADD_ACTOR', actor: canvasRef }, { to: 'undo' }),
            send({ type: 'ADD_ACTOR', actor: imageRef }, { to: 'undo' }),
            send({ type: 'ADD_ACTOR', actor: segmentRef }, { to: 'undo' }),
          ];
        }),
        forwardProject: pure(() => [forwardTo('canvas'), forwardTo('image'), forwardTo('pyodide')]),
        setFrame: assign((_, { frame }) => ({ frame })),
        setFeature: assign((_, { feature }) => ({ feature })),
        setChannel: assign((_, { channel }) => ({ channel })),
      },
    }
  );

export default createProjectMachine;
