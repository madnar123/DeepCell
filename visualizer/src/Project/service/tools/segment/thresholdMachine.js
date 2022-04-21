import { assign, Machine, send } from 'xstate';
import { fromEventBus } from '../../eventBus';
import { toolActions, toolGuards } from './toolUtils';

const createThresholdMachine = (context) =>
  Machine(
    {
      initial: 'idle',
      invoke: [
        { src: fromEventBus('threshold', () => context.eventBuses.select) },
        { id: 'api', src: fromEventBus('threshold', () => context.eventBuses.api) },
      ],
      context: {
        x: null,
        y: null,
        foreground: context.foreground,
        firstPoint: [null, null],
      },
      states: {
        idle: {
          on: {
            EXIT: 'idle',
            mousedown: { target: 'dragging', actions: 'saveFirstPoint' },
          },
        },
        dragging: {
          on: {
            mouseup: { target: 'idle', actions: 'threshold' },
          },
        },
      },
      on: {
        COORDINATES: { actions: 'setCoordinates' },
        FOREGROUND: { actions: 'setForeground' },
      },
    },
    {
      guards: toolGuards,
      actions: {
        ...toolActions,
        saveFirstPoint: assign({ firstPoint: ({ x, y }) => [x, y] }),
        threshold: send(
          ({ foreground, firstPoint, x, y }, event) => ({
            type: 'EDIT',
            action: 'threshold',
            args: {
              x1: firstPoint[0],
              y1: firstPoint[1],
              x2: x,
              y2: y,
              label: foreground,
            },
          }),
          { to: 'api' }
        ),
      },
    }
  );

export default createThresholdMachine;