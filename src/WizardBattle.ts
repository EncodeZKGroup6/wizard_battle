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
  MerkleMapWitness,
} from 'o1js';
import { transaction } from 'o1js/dist/node/lib/mina';
import { ProofOfState } from './proofs/ProofOfState';
import { ProofOfCommit } from './proofs/ProofOfCommit';
import { ProofOfApply } from './proofs/ProofOfApply';

const GameStatus = {
  init: Field.from(0),
  prep: Field.from(1),
  spellCommit: Field.from(2),
  spellReveal: Field.from(3),
  spellApply: Field.from(4),
  finished: Field.from(5),
};

export class WizardBattle extends SmartContract {
  // Markle map of the players. Id -> Hash(player)
  @state(Field) players = State<Field>();

  @state(Field) status = State<Field>();

  /// Player private statuses. Here all hidden players info is located. Can be merkle tree or just commitment. Should be decided.
  /// Merkle map of players hiiden state Hash(spels, position).
  @state(Field) playerStates = State<Field>();

  // Merkle map of commits
  @state(Field) commits = State<Field>();

  // Merkle map of actions
  @state(Field) action = State<Field>();

  // We can store it is [health, health2, health3, health4] zipped to single field, as long as health is [0, 3]
  @state(Field) health = State<Field>();
  @state(Field) alive = State<Field>();

  @state(UInt64) waitLeft =
    State<UInt64>(); /* Is this a cooldown for the spells or is the game turnbased? in which case we shpuld add it to the GameStatus and: @state(UInt8) turnCount = State<UInt8>();*/

  @method setup(playersRoot: Field) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.init);
    this.players.set(playersRoot);
    this.status.set(GameStatus.prep);
  }

  /*Copied from https://github.com/Shigoto-dev19/mina-battleships/blob/main/src/Battleships.ts */

  /*
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

  // @method joinGame(serializedBoard: Field, salt: Field, numberPlayer: Field) {
  //     // Fetch the on-chain playeri ID
  //     const storedJoinerId = this.('player'+numberPlayer+'ID').getAndRequireEquals();

  //     // Assert that game is not full
  //     expect storedJoinerId.toBeLessThanOrEqual(4, 'This game is already full!');

  //     // Assert that joiner wizzard placement is valid
  //     const boardHash = BoardCircuit.validateBoard(serializedBoard);

  //     // Calculate joiner ID & store it on-chain
  //     const joinerId = Poseidon.hash([boardHash, ...this.sender.toFields(), salt]);
  //     this.('player'+numberPlayer+'ID').set(joinerId);

  //     // Emit event for successfully joining a Battleships game
  //     this.emitEvent("Playeimport { Field, Field, Field } from 'o1js/dist/node/lib/field';r Joined: A new player has joined the hosted game!", joinerId);
  // }

  /*
    In this stage player sending their initial state with a proof, that this initial state is correct
  */
  @method setPlayerState(
    proofOfState: ProofOfState,
    playerIndex: Field,
    playerWitness: MerkleMapWitness,
    stateWitness: MerkleMapWitness
  ) {
    // Check status
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.prep);

    // Check that this.sender equals to player with playerIndex
    this.checkUserIndex(playerIndex, playerWitness);

    // Verify proof + check that this proof is right user proof
    proofOfState.verify();
    // There should be additional check for proof validity

    // Update state info
    // This works only for the first time, because we use Field(0) as a value. Next time for this user value will be nonempty,
    // so he will not be abble to call it.
    this.updateState(
      playerIndex,
      Field(0),
      proofOfState.publicOutput.state,
      stateWitness
    );

    // Check if we should go to the next phaze
    this.nextStep(GameStatus.spellCommit);
  }

  @method commitMove(
    commit: Field,
    commitProof: ProofOfCommit,
    commitWitness: MerkleMapWitness,
    playerIndex: Field,
    playerWitness: MerkleMapWitness
  ) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellCommit);

    // Check that this.sender equals to player with playerIndex
    this.checkUserIndex(playerIndex, playerWitness);

    // Update commit value
    this.updateCommit(
      playerIndex,
      Field(0),
      commitProof.publicOutput.commit, // Commit is action + salt
      commitWitness
    );

    // Verify proof
    commitProof.verify();

    this.nextStep(GameStatus.spellReveal);
  }

  @method revealMove(
    action: Field,
    actionWitness: MerkleMapWitness,
    salt: Field,
    playerIndex: Field,
    playerWitness: MerkleMapWitness,
    commitValue: Field,
    commitWitness: MerkleMapWitness
  ) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellReveal);

    // Check that this.sender equals to player with playerIndex
    this.checkUserIndex(playerIndex, playerWitness);

    // Check commit
    this.checkCommit(playerIndex, commitValue, commitWitness);

    // Check that commitment is right for such value
    const hash = Poseidon.hash([action, salt]);
    hash.assertEquals(commitValue);

    this.updateAction(playerIndex, Field.from(0), action, actionWitness);

    this.nextStep(GameStatus.spellApply);
  }

  @method apply(
    applyProof: ProofOfApply,
    playerIndex: Field,
    playerWitness: MerkleMapWitness
  ) {
    const curStatus = this.status.getAndRequireEquals();
    curStatus.assertEquals(GameStatus.spellApply);

    // Check that this.sender equals to player with playerIndex
    this.checkUserIndex(playerIndex, playerWitness);

    // Check that proof is correct and correspond to right user
    applyProof.verify();
    // There should be additional check

    // Update health
    let newPlayerHealth = applyProof.publicOutput.health;
    this.updateHealth(playerIndex, newPlayerHealth);

    let alive = this.alive.getAndRequireEquals();
    // If new health equals 0, tham
    let newAlive = Provable.if(
      newPlayerHealth.equals(Field.from(0)),
      alive.sub(Field.from(1)),
      alive
    );
    this.alive.set(newAlive);

    // If only one left - game finished, otherwize return to commit phaze
    const newStatus = Provable.if(
      newAlive.equals(Field.from(1)),
      GameStatus.finished,
      GameStatus.spellCommit
    );
    this.nextStep(newStatus);
  }

  updateState(
    playerIndex: Field,
    prevState: Field,
    newState: Field,
    stateWitness: MerkleMapWitness
  ) {
    // Compute merkle map root with provided values
    let [root, key] = stateWitness.computeRootAndKey(prevState);
    // Check that calculated root is exactly the same as on contract
    root.assertEquals(this.playerStates.getAndRequireEquals());
    // Check that key is the same, that we are trying to update
    key.assertEquals(playerIndex);
    // Caclulate new root with new values
    let [newRootValue, _] = stateWitness.computeRootAndKey(newState);
    this.playerStates.set(newRootValue);
  }

  nextStep(nextStatus: Field) {
    const waitLeft = this.waitLeft.getAndRequireEquals();
    const phazeFinished = waitLeft.equals(UInt64.from(1));
    this.waitLeft.set(Provable.if(phazeFinished, UInt64.from(4), waitLeft));
    this.status.set(
      Provable.if(phazeFinished, nextStatus, this.status.getAndRequireEquals())
    );
  }

  // This function should check if user with index <playerIndex> equals this.sender.
  // Function should work simmilar to updateState, but with different contract field and without update
  checkUserIndex(playerIndex: Field, playerWitness: MerkleMapWitness) {
    throw new Error('Method not implemented.');
  }

  // This function should works exxactly the same as updateState, but with different contract value
    updateCommit(
    playerIndex: Field,
    prevCommit: Field,
    commit: Field,
    commitWitness: MerkleMapWitness
  ) {
    // Compute merkle map root with provided values
    let [root, key] = commitWitness.computeRootAndKey(prevCommit);
    // Check that calculated root is exactly the same as on contract
    root.assertEquals(this.playerCommits.getAndRequireEquals());
    // Check that key is the same, that we are trying to update
    key.assertEquals(playerIndex);
    // Caclulate new root with new values
    let [newRootValue, _] = commitWitness.computeRootAndKey(commit);
    this.playerStates.set(newRootValue);
  }

  // this function should check if value indeed in merkle map
  checkCommit(key: Field, value: Field, commitWitness: MerkleMapWitness) {
    let [root, computedKey] = commitWitness.computeRootAndKey(value);
        computedKey.assertEquals(key);
    let storedValue = commitWitness.getValue(key);
    value.assertEquals(storedValue);
    let rootOnContract = this.playerCommits.getAndRequireEquals();
    root.assertEquals(rootOnContract);
}


  // Should work the same as updateCommit but for actions
  updateAction(
    playerIndex: Field,
    arg1: Field,
    action: Field,
    actionWitness: MerkleMapWitness
  ) {
    throw new Error('Method not implemented.');
  }

  // Set user health in health valrable. Health is sotred as [health1, health2, health3, health4]
  updateHealth(playerIndex: Field, newPlayerHealth: Field) {
    throw new Error('Method not implemented.');
  }


  
}
