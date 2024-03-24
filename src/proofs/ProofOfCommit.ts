import { Struct, ZkProgram } from 'o1js';

export class CommitPublicInput extends Struct({}) {}

export class CommitPublicOutput extends Struct({}) {}

const proveCommit = (publicInput: CommitPublicInput): CommitPublicOutput => {
  return new CommitPublicOutput({});
};

export const CommitProgramm = ZkProgram({
  name: 'state-proof',
  publicInput: CommitPublicInput,
  publicOutput: CommitPublicOutput,

  methods: {
    proveCommit: {
      privateInputs: [],
      method: proveCommit,
    },
  },
});

export class ProofOfCommit extends ZkProgram.Proof(CommitProgramm) {}
