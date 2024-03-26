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
  
  class AttackUtils { 
    /**
     * Parse a target coordinate pair into Field elements.
     * @param {number[]} target - The x/y coordinate pair representing the target.
     * @returns {Field[]} The parsed target coordinates as Field elements.
     */
    static parseTarget(target: number[]) {
        return target.map(Field);
    }

    /**
     * Serialize a target coordinate pair for attacking.
     * @param {number[]} target - The x/y coordinate pair representing the target.
     * @returns {Field} The serialized target as a Field element.
     */
    static serializeTarget(target: number[]) { 
        const parsedTarget = AttackUtils.parseTarget(target);

        const xBits = parsedTarget[0].toBits(4);
        const yBits = parsedTarget[1].toBits(4);
        const serializedTarget = Field.fromBits([...xBits, ...yBits]);

        return serializedTarget;
    }

    /**
     * Deserialize a serialized target.
     * @param {Field} serializedTarget - The serialized target as a Field elements.
     * @returns {Field[]} The deserialized x/y coordinate pair.
     */
    static deserializeTarget(serializedTarget: Field) { 
        const bits = serializedTarget.toBits(8);
        const targetX = Field.fromBits(bits.slice(0, 4));
        const targetY = Field.fromBits(bits.slice(4, 8));

        return [targetX, targetY];
    }

    /**
     * Validate a target falls within the game map range.
     * Throws an error if the target is out of bounds.
     * @param {Field} serializedTarget - The target as an array of two Field elements.
     */
    static validateTarget(target: Field[]) {
        target[0].assertLessThan(4, 'Target x coordinate is out of bound!');
        target[1].assertLessThan(4, 'Target y coordinate is out of bound!');
    }

    /**
     * Validate a serialized target to ensure it falls within the game map range after deserialization.
     * Throws an error if the target is out of bounds.
     * @param {Field} serializedTarget - The serialized target as a Field element.
     */
    static validateSerializedTarget(serializedTarget: Field) { 
        const target = AttackUtils.deserializeTarget(serializedTarget);
        AttackUtils.validateTarget(target);
    }    

    /**
     * Serialize hit count history into a single Field object.
     * @param {Field[]} hitHistory - An array containing hit count history for both players.
     * @returns {Field} The serialized hit count history as a Field object.
     */
    static healthCheck(health: Field[]) {
        // Extract hit counts for player 1 and player 2
        const [player1Health, player2Health, player3Health, player2Health] = health;
        
        // Convert hit counts to bit representations
        const player1HealthBits = player1Health,.toBits(2);
        const player2HealthBits = player2Health,.toBits(2);
        const player3HealthBits = player3Health,.toBits(2);
        const player4HealthBits = player4Health,.toBits(2);

        // Concatenate bit representations and create a single Field object
        const healthCheck = Field.fromBits([...player1HealthBits, ...player2HealthBits, ...player3HealthBits, ...player4HealthBits]);
        
        return healthCheck;
    }

    /**
     * Encode hit target coordinates into a single field element for storage efficiency.
     * 
     * We encode data differently than `serializeTarget` to showcase an alternative approach to conserve on-chain storage space.
     * When bitifying two numbers from 0 to 9 together, it typically requires 8 bits in total. However, by employing a technique
     * like bitifying an encode variable such as 9 + 9*10 + 1, we reduce the storage requirement to 7 bits. This results in a total saving of 34 bits
     * because we store a maximum of 34 targets that land a successful hit.
     * 
     * Serializing an encoded target saved 34 bits of storage otherwise we would have exceed the field element size.
     * 
     * Encoding is achieved by mapping a target [x, y] to a single field element: x + 10 * y + 1.
     * To distinguish encoded hit targets from initial values, we add one to the result. For example, if [0, 0] represents 
     * a target that successfully hits the adversary, serializing it would result in 0, which is indistinguishable from 
     * the initial value(0) and prone to errors. Therefore, we add one to the encoded value to avoid confusion and ensure 
     * proper differentiation.
     * 
     * @param {Field[]} hitTarget - The coordinates of the hit target [x, y].
     * @returns {Field} The encoded hit target.
     * @note hit target refers to a player's target that resulted in a successful hit
     */
    static encodeHitTarget(hitTarget: Field[]) { 
        const encodeHitTarget = hitTarget[0].add(hitTarget[1].mul(10)).add(1);
        return encodeHitTarget;
    }
}

class AttackCircuit {
    /**
     * Determine whether or not a given ship is hit by a given adversary target.
     * @param {Field[]} target - The x/y coordinate pair representing the adversary target.
     * @param {Field[]} ship - The wizard coordinates.
     * @returns {Bool} True if the wizard is hit, false otherwise.
     */
    static scanWizard(target: Field[], wizard: Field[]) { 
        // Return hit result for a horizontal ship
        const hitWizard = () => {
            let xHit = Bool(false);
            let yHit = Bool(false);
            xHit = xHit.or(wizard[0].equals(target[0]));
            yHit = yHit.or(wizard[1].equals(target[1]));
    
            return xHit.and(yHit);
        }
        

        // True if hit, false if missed
        const hitResult = Provable.if(wizard[2].equals(1), hitWizard());
        return hitResult;
    }

    /**
     * Determine whether or not a target hits a given board arrangement.
     * @param {Field[][]} ships - The coordinates of all wizard on the board.
     * @param {Field[]} target - The x/y coordinate pair representing the adversary target.
     * @returns {Bool} True if the target wizard a ship, false otherwise.
     */
    static attack(wizard: Field[][], target: Field[]) { 
        // Assert that the target is within board range
        AttackUtils.validateTarget(target);

        let hit = Bool(false);
        hit = hit.or(AttackCircuit.scanWizard(target, wizard));
      
        return hit;
    }
}

export class ProofOfState extends ZkProgram.Proof(StateProgramm) {}
