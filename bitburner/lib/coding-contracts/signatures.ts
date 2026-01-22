import { NS } from '@ns';

export type CodingContractSignature = {
  input: string;
  output: string;
};

export const CODING_CONTRACT_SIGNATURES: Record<string, CodingContractSignature> = {
  'Find Largest Prime Factor': { input: 'number', output: 'number' },
  'Subarray with Maximum Sum': { input: 'number[]', output: 'number' },
  'Total Ways to Sum': { input: 'number', output: 'number' },
  'Total Ways to Sum II': { input: '[number, number[]]', output: 'number' },
  'Spiralize Matrix': { input: 'number[][]', output: 'number[]' },
  'Array Jumping Game': { input: 'number[]', output: '0 | 1' },
  'Array Jumping Game II': { input: 'number[]', output: 'number' },
  'Merge Overlapping Intervals': { input: '[number, number][]', output: '[number, number][]' },
  'Generate IP Addresses': { input: 'string', output: 'string[]' },
  'Algorithmic Stock Trader I': { input: 'number[]', output: 'number' },
  'Algorithmic Stock Trader II': { input: 'number[]', output: 'number' },
  'Algorithmic Stock Trader III': { input: 'number[]', output: 'number' },
  'Algorithmic Stock Trader IV': { input: '[number, number[]]', output: 'number' },
  'Minimum Path Sum in a Triangle': { input: 'number[][]', output: 'number' },
  'Unique Paths in a Grid I': { input: '[number, number]', output: 'number' },
  'Unique Paths in a Grid II': { input: '(0 | 1)[][]', output: 'number' },
  'Shortest Path in a Grid': { input: '(0 | 1)[][]', output: 'string' },
  'Sanitize Parentheses in Expression': { input: 'string', output: 'string[]' },
  'Find All Valid Math Expressions': { input: '[string, number]', output: 'string[]' },
  'HammingCodes: Integer to Encoded Binary': { input: 'number', output: 'string' },
  'HammingCodes: Encoded Binary to Integer': { input: 'string', output: 'number' },
  'Proper 2-Coloring of a Graph': { input: '[number, [number, number][]]', output: '(0 | 1)[]' },
  'Compression I: RLE Compression': { input: 'string', output: 'string' },
  'Compression II: LZ Decompression': { input: 'string', output: 'string' },
  'Compression III: LZ Compression': { input: 'string', output: 'string' },
  'Encryption I: Caesar Cipher': { input: '[string, number]', output: 'string' },
  'Encryption II: Vigenère Cipher': { input: '[string, string]', output: 'string' },
  'Square Root': { input: 'bigint', output: 'bigint | [string, string]' },
};

export function getCodingContractSignature(name: string): CodingContractSignature | null {
  return CODING_CONTRACT_SIGNATURES[name] ?? null;
}

export function buildCodingContractSignatureMap(
  ns: NS,
): Record<
  (typeof ns.enums.CodingContractName)[keyof typeof ns.enums.CodingContractName],
  CodingContractSignature
> {
  const names = ns.enums.CodingContractName;
  return {
    [names.FindLargestPrimeFactor]: CODING_CONTRACT_SIGNATURES['Find Largest Prime Factor'],
    [names.SubarrayWithMaximumSum]: CODING_CONTRACT_SIGNATURES['Subarray with Maximum Sum'],
    [names.TotalWaysToSum]: CODING_CONTRACT_SIGNATURES['Total Ways to Sum'],
    [names.TotalWaysToSumII]: CODING_CONTRACT_SIGNATURES['Total Ways to Sum II'],
    [names.SpiralizeMatrix]: CODING_CONTRACT_SIGNATURES['Spiralize Matrix'],
    [names.ArrayJumpingGame]: CODING_CONTRACT_SIGNATURES['Array Jumping Game'],
    [names.ArrayJumpingGameII]: CODING_CONTRACT_SIGNATURES['Array Jumping Game II'],
    [names.MergeOverlappingIntervals]: CODING_CONTRACT_SIGNATURES['Merge Overlapping Intervals'],
    [names.GenerateIPAddresses]: CODING_CONTRACT_SIGNATURES['Generate IP Addresses'],
    [names.AlgorithmicStockTraderI]: CODING_CONTRACT_SIGNATURES['Algorithmic Stock Trader I'],
    [names.AlgorithmicStockTraderII]: CODING_CONTRACT_SIGNATURES['Algorithmic Stock Trader II'],
    [names.AlgorithmicStockTraderIII]: CODING_CONTRACT_SIGNATURES['Algorithmic Stock Trader III'],
    [names.AlgorithmicStockTraderIV]: CODING_CONTRACT_SIGNATURES['Algorithmic Stock Trader IV'],
    [names.MinimumPathSumInATriangle]: CODING_CONTRACT_SIGNATURES['Minimum Path Sum in a Triangle'],
    [names.UniquePathsInAGridI]: CODING_CONTRACT_SIGNATURES['Unique Paths in a Grid I'],
    [names.UniquePathsInAGridII]: CODING_CONTRACT_SIGNATURES['Unique Paths in a Grid II'],
    [names.ShortestPathInAGrid]: CODING_CONTRACT_SIGNATURES['Shortest Path in a Grid'],
    [names.SanitizeParenthesesInExpression]:
      CODING_CONTRACT_SIGNATURES['Sanitize Parentheses in Expression'],
    [names.FindAllValidMathExpressions]:
      CODING_CONTRACT_SIGNATURES['Find All Valid Math Expressions'],
    [names.HammingCodesIntegerToEncodedBinary]:
      CODING_CONTRACT_SIGNATURES['HammingCodes: Integer to Encoded Binary'],
    [names.HammingCodesEncodedBinaryToInteger]:
      CODING_CONTRACT_SIGNATURES['HammingCodes: Encoded Binary to Integer'],
    [names.Proper2ColoringOfAGraph]: CODING_CONTRACT_SIGNATURES['Proper 2-Coloring of a Graph'],
    [names.CompressionIRLECompression]:
      CODING_CONTRACT_SIGNATURES['Compression I: RLE Compression'],
    [names.CompressionIILZDecompression]:
      CODING_CONTRACT_SIGNATURES['Compression II: LZ Decompression'],
    [names.CompressionIIILZCompression]:
      CODING_CONTRACT_SIGNATURES['Compression III: LZ Compression'],
    [names.EncryptionICaesarCipher]: CODING_CONTRACT_SIGNATURES['Encryption I: Caesar Cipher'],
    [names.EncryptionIIVigenereCipher]:
      CODING_CONTRACT_SIGNATURES['Encryption II: Vigenère Cipher'],
    [names.SquareRoot]: CODING_CONTRACT_SIGNATURES['Square Root'],
  };
}
