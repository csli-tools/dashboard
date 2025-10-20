import { autoParseNestedJson } from '../src/utils/json-auto-parse';

describe('JSON Auto-Parse', () => {
  describe('Basic JSON parsing', () => {
    it('should parse JSON strings in object values', () => {
      const input = {
        msg: '{"action":"swap","params":{"pool_id":5516}}'
      };

      const result = autoParseNestedJson(input);

      expect(result.msg).toEqual({
        action: 'swap',
        params: { pool_id: 5516 }
      });
    });

    it('should parse JSON arrays in string values', () => {
      const input = {
        memo: '[{"pool_id":5516,"to":"alice.near"}]'
      };

      const result = autoParseNestedJson(input);

      expect(result.memo).toEqual([
        { pool_id: 5516, to: 'alice.near' }
      ]);
    });

    it('should handle nested JSON strings', () => {
      const input = {
        outer: '{"inner":"{\\"deep\\":\\"value\\"}"}'
      };

      const result = autoParseNestedJson(input);

      expect(result.outer).toEqual({
        inner: { deep: 'value' }
      });
    });
  });

  describe('Edge cases', () => {
    it('should return original string if not valid JSON', () => {
      const input = {
        notJson: 'just a regular string',
        almostJson: '{invalid json}'
      };

      const result = autoParseNestedJson(input);

      expect(result.notJson).toBe('just a regular string');
      expect(result.almostJson).toBe('{invalid json}');
    });

    it('should handle null and undefined values', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: ''
      };

      const result = autoParseNestedJson(input);

      expect(result).toEqual(input);
    });

    it('should respect max depth limit', () => {
      // Create deeply nested JSON string
      let jsonStr = '"value"';
      for (let i = 0; i < 10; i++) {
        jsonStr = `{"level${i}":${jsonStr}}`;
      }

      const input = { deep: jsonStr };
      const result = autoParseNestedJson(input, 3);

      // Should only parse 3 levels deep
      expect(result.deep.level0.level1).toBeDefined();
      expect(typeof result.deep.level0.level1.level2).toBe('string');
    });

    it('should handle very large strings', () => {
      const largeString = '{' + '"a":"' + 'x'.repeat(2 * 1024 * 1024) + '"}';
      const input = { large: largeString };

      const result = autoParseNestedJson(input);

      // Should skip parsing due to size limit
      expect(result.large).toBe(largeString);
    });
  });

  describe('Arrays', () => {
    it('should parse JSON strings in arrays', () => {
      const input = [
        '{"id":1}',
        '{"id":2}',
        'not json'
      ];

      const result = autoParseNestedJson(input);

      expect(result).toEqual([
        { id: 1 },
        { id: 2 },
        'not json'
      ]);
    });

    it('should handle nested arrays with JSON strings', () => {
      const input = {
        items: [
          { data: '[1,2,3]' },
          { data: '{"nested":true}' }
        ]
      };

      const result = autoParseNestedJson(input);

      expect(result.items[0].data).toEqual([1, 2, 3]);
      expect(result.items[1].data).toEqual({ nested: true });
    });
  });

  describe('Real-world NEAR transaction examples', () => {
    it('should parse execute_intents payload', () => {
      const input = {
        FunctionCall: {
          method_name: 'execute_intents',
          args: {
            payload: '{"message":"{\\"signer_id\\":\\"alice.near\\",\\"amount\\":\\"1000\\"}"}'
          }
        }
      };

      const result = autoParseNestedJson(input);

      expect(result.FunctionCall.args.payload).toEqual({
        message: {
          signer_id: 'alice.near',
          amount: '1000'
        }
      });
    });

    it('should parse ft_transfer msg field', () => {
      const input = {
        FunctionCall: {
          method_name: 'ft_transfer',
          args: {
            receiver_id: 'bob.near',
            amount: '1000000',
            msg: '{"action":"swap","pool_id":5516}'
          }
        }
      };

      const result = autoParseNestedJson(input);

      expect(result.FunctionCall.args.msg).toEqual({
        action: 'swap',
        pool_id: 5516
      });
    });
  });
});