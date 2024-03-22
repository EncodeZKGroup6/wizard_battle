import {
  Field,
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Provable,
  UInt64,
} from 'o1js';

const GameStatus = {
  init: Field.from(0),
  prep: Field.from(1),
  spellCommit: Field.from(2),
  spellReveal: Field.from(3),
  spellApply: Field.from(4),
  finished: Field.from(5),
};

export class WizardBattle extends SmartContract {
  // Merkle tree of players
  @state(Field) players = State<Field>();

  @state(Field) status = State<Field>();

  /// Player private statuses. Here all hidden players info is located. Can be merkle tree or just commitment. Should be decided.
  @state(Field) player1Status = State<Field>();
  @state(Field) player2Status = State<Field>();
  @state(Field) player3Status = State<Field>();
  @state(Field) player4Status = State<Field>();

  @state(UInt64) waitLeft = State<UInt64>();

  @method setup(playersRoot: Field) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.init);
    this.players.set(playersRoot);
    this.status.set(GameStatus.prep);
  }

  /*
    In this stage player sending their initial state with a proof, that this initial state is correct
  */
  @method setPlayerState(state: Field, proofOfState: ProofOfState) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.prep);

    proofOfState.verify();

    // Verify, that sender is player

    const waitLeft = this.waitLeft.getAndRequireEquals();
    const prepFinished = waitLeft.equals(UInt64.from(1));
    this.waitLeft.set(Provable.if(prepFinished, UInt64.from(4), waitLeft));
    this.status.set(
      Provable.if(
        prepFinished,
        GameStatus.spellCommit,
        this.status.getAndRequireEquals()
      )
    );
  }

  @method commitMove(commit: Field, commitProof: ProofOfCommit) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellCommit);
  }

  @method revealMove(value: Field) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellReveal);
  }

  @method apply(appyProof: ProofOfApply) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellApply);
  }
}
