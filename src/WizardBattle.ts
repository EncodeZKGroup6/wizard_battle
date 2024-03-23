import {
  Field,
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Provable,
  Poseidon,
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

  @state(UInt64) waitLeft = State<UInt64>();  /* Is this a cooldown for the spells or is the game turnbased? in which case we shpuld add it to the GameStatus and: @state(UInt8) turnCount = State<UInt8>();*/

  @method setup(playersRoot: Field) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.init);
    this.players.set(playersRoot);
    this.status.set(GameStatus.prep);
  }
  
  /*Copied from https://github.com/Shigoto-dev19/mina-battleships/blob/main/src/Battleships.ts */
  
  @method hostGame(serializedBoard: Field, salt: Field) {
    // Fetch the on-chain player1 ID
    const storedHostId = this.player1Id.getAndRequireEquals();

    storedHostId.assertEquals(0, "This game already has a host!");

    // Assert that board ship placements are valid
    const boardHash = BoardCircuit.validateBoard(serializedBoard);  

    // Calculate host ID & store it on-chain
    const hostId = Poseidon.hash([boardHash, ...this.sender.toFields(), salt]);
    this.player1Id.set(hostId);

    // Emit event for successfully hosting a Battleships game
    this.emitEvent("Game Hosted: A new Wizzard Battle game has been initiated!", hostId);
  }  
  
  /*Adapted from https://github.com/Shigoto-dev19/mina-battleships/blob/main/src/Battleships.ts*/
  
  @method joinGame(serializedBoard: Field, salt: Field, numberPlayer: Field) {  
      // Fetch the on-chain playeri ID
      const storedJoinerId = this.('player'+numberPlayer+'ID').getAndRequireEquals();

      // Assert that game is not full
      expect storedJoinerId.toBeLessThanOrEqual(4, 'This game is already full!');

      // Assert that joiner wizzard placement is valid
      const boardHash = BoardCircuit.validateBoard(serializedBoard);  
      
      // Calculate joiner ID & store it on-chain
      const joinerId = Poseidon.hash([boardHash, ...this.sender.toFields(), salt]);
      this.('player'+numberPlayer+'ID').set(joinerId);

      // Emit event for successfully joining a Battleships game
      this.emitEvent("Player Joined: A new player has joined the hosted game!", joinerId);
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
