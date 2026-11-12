import unittest

from polyspec.crudui.validator.pattern import compile_pattern


class TestPatternStates(unittest.TestCase):
    """A repetition compiles to a bounded number of NFA states, as in the PHP engine."""

    def test_repetition_compiles_to_bounded_states(self):
        self.assertLess(compile_pattern("((){1000}){1000}").state_count, 10)
        self.assertLess(compile_pattern("(|()*)+").state_count, 10)
        self.assertLess(compile_pattern("\\p{L}{1000}").state_count, 1100)
        self.assertLess(compile_pattern("((a{10})*){100}").state_count, 1300)


if __name__ == "__main__":
    unittest.main()
