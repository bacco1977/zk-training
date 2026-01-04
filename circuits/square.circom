pragma circom 2.1.6;

template Square() {
    signal input x;
    signal output y;

    y <== x * x;
}

component main = Square();

