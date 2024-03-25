import { Field, Struct, ZkProgram } from 'o1js';
import { WizardState } from '../types';

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
  state: WizardState
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
      privateInputs: [WizardState],
      method: proveState,
    },
  },
});

/*Adapted from https://github.com/Shigoto-dev19/mina-battlewizards/blob/main/src/provableUtils.ts*/
class BoardUtils {
    static serialize(board: number[][]) { 
        let serializedCoordinates: Bool[][][] = [];
        for (const wizardCoordinates of board) { 
            let x = Field(wizardCoordinates[0]).toBits(8);
            let y = Field(wizardCoordinates[1]).toBits(8);
            serializedCoordinates.push([x, y]);
        }
        // The serialized board is a 120-bit field (24 * 5).
        const serializedBoard = Field.fromBits(serializedCoordinates.flat().flat());
        
        return serializedBoard;
    }

    /**
     * Deserialize the given serialized wizard_battle board.
     * @param {Field} serializedBoard - The serialized representation of the wizard_battle board.
     * @returns {number[][]} An array of wizard configurations, where each wizard is represented as [x, y] coordinates:
     *                        x = x coordinate on the board
     *                        y = y coordinate on the board
     */
    static deserialize(serializedBoard: Field) { 
        // Split an array into groups of a specified size.
        const splitArrayIntoGroups= <T>(array: T[], groupSize: number): T[][] => { 
            let result: T[][] = [];
            for (let i = 0; i < array.length; i += groupSize) {
                result.push(array.slice(i, i + groupSize));
            }
            return result;
        };

        // Convert serialized board to an array of bits
        let bits = serializedBoard.toBits(120);    /*Do we need to change the field size?*/

        // Convert bits into serialized coordinates (x, y)
        let serializedCoordinates = splitArrayIntoGroups(bits, 8).map(f => Field.fromBits(f));

        // Split serialized coordinates into wizard configurations (x, y) groups
        let board = splitArrayIntoGroups(serializedCoordinates, 2);

        return board;
    }

    /**
     * Parse the given battlewizards board by converting each wizard's coordinates to Field elements.
     * @param {number[][]} board - The battlewizards board to parse.
     * @returns {Field[][]} The parsed battlewizards board where each wizard's coordinates are represented as Field elements.
     */
    static parse(board: number[][]) { 
        return board.map((wizard) => wizard.map(Field));
    } 

    /**
     * Calculate the poseidon hash of the given battlewizards board represented as Field elements.
     * @param {Field[][]} board - The battlewizards board represented as Field elements.
     * @returns {Field} The hash of the battlewizards board.
     */
    static hash(board: Field[][]) { 
        return Poseidon.hash(board.flat());
    }  

    /**
     * Calculate the hash of the serialized battlewizards board.
     * @param {Field} serializedBoard - The serialized representation of the battlewizards board.
     * @returns {Field} The hash of the serialized battlewizards board.
     */
    static hashSerialized(serializedBoard: Field) { 
        const deserializedBoard = BoardUtils.deserialize(serializedBoard);
        return BoardUtils.hash(deserializedBoard);
    }

    /**
     * Generate a player ID based on the serialized battlewizards board, player address, and salt.
     * @param {Field} serializedBoard - The serialized representation of the battlewizards board.
     * @param {PublicKey} playerAddress - The address of the player.
     * @param {Field} salt - The salt value used for generating the player ID.
     * @returns {Field} The generated player ID.
     */
    static generatePlayerId(serializedBoard: Field, playerAddress: PublicKey, salt: Field) {
        const boardHash = BoardUtils.hashSerialized(serializedBoard);
        return Poseidon.hash([boardHash, ...playerAddress.toFields(), salt]);
    }
}

class BoardCircuit { 
    /**
     * Validate that the wizard is within the bounds of the battlewizards grid.
     * @param {Field[]} wizard - The coordinates of the wizard represented as Field elements.
     * @param {number} wizardLength - The length of the wizard.
     * @param {string} errorMessage - The error message to display if the wizard is out of range.
     */
    static validatewizardInRange(wizard: Field[], errorMessage: string) { 

        const check = () => {
            const hCheck = wizard[0].lessThan(4); /*4 by 4 board right?*/
            const vCheck = wizard[1].lessThan(4);
            return hCheck.and(vCheck);
        };

        // Perform the appropriate range check based on the orientation of the wizard
        const isInRange = Provable.if(check());
        
        // Assert that the wizard is within range, otherwise display the error message
        isInRange.assertTrue(errorMessage);
    }

    /**
     * Place the wizard on the battlewizards board and validate that there are no collisions.
     * @param {Field[]} wizard - The coordinates of the wizard represented as Field objects.
     * @param {number} wizardLength - The length of the wizard.
     * @param {Field[]} boardMap - The map of the battlewizards grid.
     * @param {string} errorMessage - The error message to display if there is a collision.
     * @returns {Field[]} The updated map of the battlewizards board after placing the wizard.
     */
    static placewizard(wizard: Field[], wizardLength: number, boardMap: Field[], errorMessage: string) { 
        // Determine the increment value based on the orientation of the wizard
        const increment = Provable.if(Field(1), Field(1));
        
        const location = wizard[0].add(wizard[1].mul(10));
        let coordinate = location;

        coordinate;
        const collisionExists = Provable.witness(Bool, () => {
              const collisionOccurence = boardMap.some(item => item.equals(coordinate).toBoolean());
              return Bool(collisionOccurence);
        });

        // Assert that there is no collision, otherwise display the error message
        collisionExists.assertFalse(errorMessage); 
            
        // Add the coordinate to the board map
        boardMap.push(coordinate);

        // Return the updated board map
        return boardMap;
    }

    /**
     * Validate the locations of all wizards on the battlewizards map.
     * @param {Field[][]} wizards - The coordinates of all wizards represented as 2D array of Field elements.
     */
    static validatewizardsLocation(wizards: Field[][]) {
        
        let boardMap: Field[] = [];
        // Perform range check for the current wizard
        let rangeErrorMessage = `Invalid Board! wizard is out of board range!`;
        BoardCircuit.validatewizardInRange(wizards, rangeErrorMessage);
    }

    /**
     * Deserialize board and validate wizard placements.
     * @param {Field} serializedBoard - The serialized representation of the battlewizards board.
     * @returns {Field} The hash of the validated battlewizards board.
     */
    static validateBoard(serializedBoard: Field) { 
        // Deserialize the serialized board to obtain the board configuration
        const board = BoardUtils.deserialize(serializedBoard);
        // Validate the locations of all wizards on the board
        this.validatewizardsLocation(board);
        // Calculate the hash of the validated board
        const boardHash = BoardUtils.hash(board);
        
        return boardHash;
    }
}

export class ProofOfState extends ZkProgram.Proof(StateProgramm) {}
