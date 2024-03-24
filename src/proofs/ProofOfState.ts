import { Field, Struct, ZkProgram } from 'o1js';

export class StatePublicInput extends Struct({
  index: Field,
}) {}

export class StatePublicOutput extends Struct({
  state: Field,
}) {}

/*
    This one should check that:
        1) spell1 and spell2 is in [0, 3]
        2) posX and posY is right (for 1st is top left corner, for second it top right corner, for third is bottom left, for fourth is bottom right)
    And return state as Hash(spell1, spell2, posx, posy, salt)
*/
const proveState = (
  publicInput: StatePublicInput,
  spell1: Field,
  spell2: Field,
  posx: Field,
  posY: Field,
  salt: Field
): StatePublicOutput => {
  return new StatePublicOutput({
    state: Field.from(0),
  });
};

export const StateProgramm = ZkProgram({
  name: 'state-proof',
  publicInput: StatePublicInput,
  publicOutput: StatePublicOutput,

  methods: {
    proveState: {
      privateInputs: [Field, Field, Field, Field, Field],
      method: proveState,
    },
  },
});

export class ProofOfState extends ZkProgram.Proof(StateProgramm) {}
