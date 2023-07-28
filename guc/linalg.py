"""
Ad hoc linear algebra library for my games
"""
import typing
import math


_MatrixValues = typing.Tuple[
    float, float, float, float,
    float, float, float, float,
    float, float, float, float,
    float, float, float, float]


class Matrix:
    """
    Simple 4x4 matrix class for use in games
    """
    __slots__ = ['_values']

    @classmethod
    @property
    def ZERO(cls) -> 'Matrix':
        return _ZERO

    @classmethod
    @property
    def ONE(cls) -> 'Matrix':
        return _ONE

    @staticmethod
    def newRotateX(radians: float) -> 'Matrix':
        cos = math.cos(radians)
        sin = math.sin(radians)
        return Matrix((
            1, 0, 0, 0,
            0, cos, -sin, 0,
            0, sin, cos, 0,
            0, 0, 0, 1,
        ))

    @staticmethod
    def newRotateY(radians: float) -> 'Matrix':
        cos = math.cos(radians)
        sin = math.sin(radians)
        return Matrix((
            cos, 0, sin, 0,
            0, 1, 0, 0,
            -sin, 0, cos, 0,
            0, 0, 0, 1,
        ))

    @staticmethod
    def newRotateZ(radians: float) -> 'Matrix':
        cos = math.cos(radians)
        sin = math.sin(radians)
        return Matrix((
            cos, -sin, 0, 0,
            sin, cos, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ))

    @typing.overload
    @staticmethod
    def newTranslate(x: float, y: float, z: float=0) -> 'Matrix': ...

    @typing.overload
    @staticmethod
    def newTranslate(x: 'Vector') -> 'Matrix': ...

    @staticmethod
    def newTranslate(x: 'Vector | float', y: float=0, z: float=0) -> 'Matrix':
        if isinstance(x, Vector):
            return Matrix.newTranslate(x.x, x.y, x.z)
        return Matrix((
            1, 0, 0, x,
            0, 1, 0, y,
            0, 0, 1, z,
            0, 0, 0, 1,
        ))

    def __init__(self, values: _MatrixValues) -> None:
        self._values = values

    def det3x3(self) -> float:
        """
        Compute the determinant of the upperleft 3x3 submatrix
        """
        (
            a11, a12, a13, _,
            a21, a22, a23, _,
            a31, a32, a33, _,
              _,   _,   _, _,
        ) = self._values
        return (0
            + a11 * a22 * a33 + a12 * a23 * a31 + a13 * a21 * a32
            - a11 * a23 * a32 - a12 * a21 * a33 - a13 * a22 * a31
        )

    def det(self) -> float:
        """
        Compute the determinant of this 4x4 matrix
        """
        (
            a11, a12, a13, a14,
            a21, a22, a23, a24,
            a31, a32, a33, a34,
            a41, a42, a43, a44
        ) = self._values
        return (0
            + a11*a22*a33*a44 + a11*a23*a34*a42 + a11*a24*a32*a43
            - a11*a24*a33*a42 - a11*a23*a32*a44 - a11*a22*a34*a43
            - a12*a21*a33*a44 - a13*a21*a34*a42 - a14*a21*a32*a43
            + a14*a21*a33*a42 + a13*a21*a32*a44 + a12*a21*a34*a43
            + a12*a23*a31*a44 + a13*a24*a31*a42 + a14*a22*a31*a43
            - a14*a23*a31*a42 - a13*a22*a31*a44 - a12*a24*a31*a43
            - a12*a23*a34*a41 - a13*a24*a32*a41 - a14*a22*a33*a41
            + a14*a23*a32*a41 + a13*a22*a34*a41 + a12*a24*a33*a41
        )

    @typing.overload
    def __mul__(self, other: 'Matrix') -> 'Matrix': ...

    @typing.overload
    def __mul__(self, other: 'Vector') -> 'Vector': ...

    def __mul__(self, other: 'Matrix | Vector'):
        a = self._values
        if isinstance(other, Matrix):
            b = other._values
            return Matrix(tuple(
                sum(a[4 * r + k] * b[4 * k + c] for k in range(4))
                for r in range(4)
                for c in range(4)
            ))
        v = other.values
        return Vector(
            a[0 + 0] * v[0] + a[0 + 1] * v[1] + a[0 + 2] * v[2] + a[0 + 3],
            a[4 + 0] * v[0] + a[4 + 1] * v[1] + a[4 + 2] * v[2] + a[4 + 3],
            a[8 + 0] * v[0] + a[8 + 1] * v[1] + a[8 + 2] * v[2] + a[8 + 3],
        )

    def rotateX(self, radians: float) -> 'Matrix':
        return Matrix.newRotateX(radians) * self

    def rotateY(self, radians: float) -> 'Matrix':
        return Matrix.newRotateY(radians) * self

    def rotateZ(self, radians: float) -> 'Matrix':
        return Matrix.newRotateZ(radians) * self

    @typing.overload
    def translate(self, x: float, y: float, z: float=0) -> 'Matrix': ...

    @typing.overload
    def translate(self, x: 'Vector') -> 'Matrix': ...

    def translate(self, x: 'Vector | float', y: float=0, z: float=0) -> 'Matrix':
        if isinstance(x, Vector):
            return self.translate(x.x, x.y, x.z)
        return Matrix.newTranslate(x, y, z) * self

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Matrix) and self._values == other._values

    def __hash__(self) -> int:
        return hash(self._values)

    def __repr__(self) -> str:
        return f"Matrix({self._values})"

_ZERO = Matrix((
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
))

_ONE = Matrix((
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
))


class Vector:
    __slots__ = ['_values']

    def __init__(self, x: float, y: float, z: float=0) -> None:
        self._values = (x, y, z)

    @property
    def x(self) -> float:
        return self._values[0]

    @property
    def y(self) -> float:
        return self._values[1]

    @property
    def z(self) -> float:
        return self._values[2]

    @property
    def values(self) -> typing.Tuple[float, float, float]:
        return self._values

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Vector) and self._values == other._values

    def __hash__(self) -> int:
        return hash(self._values)

    def __repr__(self) -> str:
        return f"Vector({self.x}, {self.y}, {self.z})"

    def __add__(self, other: 'Vector') -> 'Vector':
        return Vector(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other: 'Vector') -> 'Vector':
        return Vector(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, other: float) -> 'Vector':
        return Vector(self.x * other, self.y * other, self.z * other)

    def __div__(self, other: float) -> 'Vector':
        return Vector(self.x / other, self.y / other, self.z / other)
