import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
  MerkleMap,
  Poseidon,
} from 'o1js';
import { WizardBattle } from './WizardBattle';
import { ApplyProgram, ProofOfApply } from './proofs/ProofOfApply';
import { StateProgram, StatePublicInput } from './proofs/ProofOfState';
import { CommitProgram } from './proofs/ProofOfCommit';
import { WizardState } from './types';

/*
 * This file specifies how to test the `WizardBattle` smart contract
 */

let proofsEnabled = false;

class Player {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  index: Field;

  hash() {
    return Poseidon.hash(this.publicKey.toFields());
  }
}

describe('BatchMessageProcessor', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    players: Player[],
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: WizardBattle;

  beforeAll(async () => {
    let startTime = Date.now();
    if (proofsEnabled) {
      StateProgram.compile();
      ApplyProgram.compile();
      CommitProgram.compile();
    }
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    players = Local.testAccounts.slice(1, 5).map((account, i) => {
      return { ...account, index: Field.from(i) } as Player;
    });
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new WizardBattle(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('One big correct game', async () => {
    await localDeploy();
    // Set players
    let playersMerkleMap = new MerkleMap();
    let statesMerkleMap = new MerkleMap();
    for (const player of players) {
      playersMerkleMap.set(player.index, player.hash());
    }

    let tx = await Mina.transaction(players[0].publicKey, () => {
      zkApp.setup(playersMerkleMap.getRoot());
    });

    await tx.prove();
    await tx.sign([players[0].privateKey]).send();

    // Set players states
    for (const player of players) {
      const state = WizardState.random();
      const publicInput = new StatePublicInput({
        index: player.index,
      });
      const proofOfState = await StateProgram.proveState(publicInput, state);
      statesMerkleMap.set(player.index, state.hash());
      tx = await Mina.transaction(player.publicKey, () => {
        zkApp.setPlayerState(
          proofOfState,
          player.index,
          playersMerkleMap.getWitness(player.index),
          statesMerkleMap.getWitness(player.index)
        );
      });

      await tx.prove();
      await tx.sign([player.privateKey]).send();
    }

    // N rounds of commit, reveal, apply

    // Check winners
  });
});
