import { Field, Struct, ZkProgram } from 'o1js';

export class CommitPublicInput extends Struct({
  state: Field,
}) {}

export class CommitPublicOutput extends Struct({
  commit: Field,
}) {}

/*
    This should check, that wizzard have right to cast spell and move in this direction.
    For this we need to reconstruct state using (spell1, spell2, posx, posY, stateSalt) and check
    that it is the same as in PublicInput.
    Than we need to check, that movemint is right and do not cross the border.
    Finaly we need to construct commitment as Hash(action, actionSalt)
*/
const proveCommit = (
  publicInput: CommitPublicInput,
  spell1: Field,
  spell2: Field,
  posX: Field,
  posY: Field,
  stateSalt: Field,
  action: Field,
  actionSalt: Field
): CommitPublicOutput => {
  return new CommitPublicOutput({
    commit: Field.from(0),
  });
};

export const CommitProgramm = ZkProgram({
  name: 'state-proof',
  publicInput: CommitPublicInput,
  publicOutput: CommitPublicOutput,

  methods: {
    proveCommit: {
      privateInputs: [Field, Field, Field, Field, Field, Field, Field],
      method: proveCommit,
    },
  },
});

export class ProofOfCommit extends ZkProgram.Proof(CommitProgramm) {}
