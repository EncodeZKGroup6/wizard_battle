import { Field, SmartContract, state, State, method, PublicKey } from 'o1js';

const GameStatus = {
  init: Field.from(0),
  prep: Field.from(1),
  spellCommiment: Field.from(2),
  spellReveal: Field.from(3),
  finished: Field.from(4),
};

export class Square extends SmartContract {
  // Merkle tree of players
  @state(Field) players = State<Field>();

  @state(Field) status = State<Field>();

  /// Player private statuses. Here all hidden players info is located. Can be merkle tree or just commitment. Should be decided.
  @state(Field) player1Status = State<Field>();
  @state(Field) player2Status = State<Field>();
  @state(Field) player3Status = State<Field>();
  @state(Field) player4Status = State<Field>();

  @state(Field) waitLeft = State<Field>();

  @method setup(playersRoot: Field) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.init);
    this.players.set(playersRoot);
    this.status.set(GameStatus.prep);
  }

  @method setPlayerState(state: Field, proofOfState: ProofOfState) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.prep);

    proofOfState.verify();
  }

  @method commitMove() {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellCommiment);
  }

  @method revealMove() {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellReveal);
  }
}
