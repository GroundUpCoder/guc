import unittest
from guc.linalg import Matrix


class TestMatrixMethods(unittest.TestCase):

    def test_det3x3(self):
        self.assertEqual(
            Matrix((
                1, 5, 3, 0,
                2, 4, 7, 0,
                4, 6, 2, 0,
                0, 0, 0, 0,
            )).det3x3(),
            74,
        )
    def test_det(self):
        self.assertEqual(
            Matrix((
                2, -5, 77, 3,
                -2, -11, 1, 23,
                33, 22, 75, 4,
                15, -5, -7 ,2,
            )).det(),
            -985488,
        )
        self.assertEqual(
            Matrix((
                1, 1, 1, -1,
                1, 1, -1, 1,
                1, -1, 1, 1,
                -1, 1, 1, 1,
            )).det(),
            -16,
        )


if __name__ == '__main__':
    unittest.main()
