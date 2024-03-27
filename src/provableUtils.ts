/**
 * This file contains both provable functions and utilities/helpers for the WizardBattle zkapp, 
 * serving both functional and testing purposes.
 * 
 * In this context:
 * - Circuits refer to provable code directly utilized within the WizardBattle zkapp.
 * - Utils denote utilities and helpers responsible for parsing inputs or providing 
 *   provable building blocks for a circuit.
 */

import { 
    Field, 
    Bool,
    Poseidon,
    Provable,
    PublicKey,
} from 'o1js';

export { 
    BoardUtils
}

class BoardUtils {
    /**
     * Serialize the given wizard configuration.
     * @param {number[][]} board - An array of wizard configurations, where the wizard is represented as [x, y] coordinates:
     *                             x = x coordinate on the board
     *                             y = y coordinate on the board
     * @returns {Field} The serialized representation of the wizard board.
     */
    static serialize(board: number[][]) { 
        let serializedCoordinates: Bool[][][] = [];
        for (const wizardCoordinates of board) { 
            let x = Field(wizardCoordinates[0]).toBits(8);
            let y = Field(wizardCoordinates[1]).toBits(8);
            serializedCoordinates.push([x, y]);
        }
        // The serialized board is a 48-bit field (16 * 3)
        const serializedBoard = Field.fromBits(serializedCoordinates.flat().flat());
        
        return serializedBoard;
    }

    /**
     * Deserialize the given serialized wizard board.
     * @param {Field} serializedBoard - The serialized representation of the wizard board.
     * @returns {number[][]} An array of wizard configurations, the wizard is represented as [x, y] coordinates:
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
        let bits = serializedBoard.toBits(48);

        // Convert bits into serialized coordinates (x, y)
        let serializedCoordinates = splitArrayIntoGroups(bits, 8).map(f => Field.fromBits(f));

        // Split serialized coordinates into wizard configurations (x, y) groups
        let board = splitArrayIntoGroups(serializedCoordinates, 2);

        return board;
    }

    /**
     * Parse the given wizard board by converting each wizard's coordinates to Field elements.
     * @param {number[][]} board - The wizards board to parse.
     * @returns {Field[][]} The parsed wizards board where each ship's coordinates are represented as Field elements.
     */
    static parse(board: number[][]) { 
        return board.map((wizard) => wizard.map(Field));
    } 

    /**
     * Calculate the poseidon hash of the given wizards board represented as Field elements.
     * @param {Field[][]} board - The wizards board represented as Field elements.
     * @returns {Field} The hash of the wizards board.
     */
    static hash(board: Field[][]) { 
        return Poseidon.hash(board.flat());
    }  

    /**
     * Calculate the hash of the serialized wizards board.
     * @param {Field} serializedBoard - The serialized representation of the wizards board.
     * @returns {Field} The hash of the serialized wizards board.
     */
    static hashSerialized(serializedBoard: Field) { 
        const deserializedBoard = BoardUtils.deserialize(serializedBoard);
        return BoardUtils.hash(deserializedBoard);
    }

    /**
     * Generate a player ID based on the serialized wizards board, player address, and salt.
     * @param {Field} serializedBoard - The serialized representation of the wizards board.
     * @param {PublicKey} playerAddress - The address of the player.
     * @param {Field} salt - The salt value used for generating the player ID.
     * @returns {Field} The generated player ID.
     */
    static generatePlayerId(serializedBoard: Field, playerAddress: PublicKey, salt: Field) {
        const boardHash = BoardUtils.hashSerialized(serializedBoard);
        return Poseidon.hash([boardHash, ...playerAddress.toFields(), salt]);
    }
}