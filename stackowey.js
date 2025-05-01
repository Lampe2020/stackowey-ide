'use strict';

const UINT64_MAX = 2n ** 64n - 1n;

const isNode = () =>
    typeof process !== 'undefined' &&
    !!process.versions &&
    !!process.versions.node;

const Direction = Object.freeze({
    RIGHT: 0,
    DOWN: 1,
    LEFT: 2,
    UP: 3
});

if (isNode()) {
    const fs = await import('fs');  // In node ES modules, `await` seems to be possible in the top scope.
    const stdin = (process.platform === 'win32') ? process.stdin.fd : fs.openSync('/dev/tty', 'rs');
    global.prompt = function prompt(question) { // Kinda hacky and buggy/bad implementation, but enough for this.
        // Inspired by https://github.com/heapwolf/prompt-sync/blob/33a12524a6c829b7a1379939d866d903ab2e375e/index.js#L49
        if (!process.stdin.isRaw) process?.stdin?.setRawMode?.(true);
        if (question) process.stdout.write(question);
        const buf = Buffer.alloc(1);
        const input = [];
        readInput: while (fs.readSync(stdin, buf, 0, 1)) {
            if (['\r', '\n', '\u0003', '\u0004'].includes(buf.toString())) break;
            switch (buf.toString()) {
                case '\r':      // CR
                case '\n':      // LF
                case '\x03':    // Ctrl+C
                case '\x04': {  // Ctrl+D
                    process.stdout.write('\n'); // End the input line
                    break readInput;
                }
                case '\b':      // Backspace
                case '\x7f': {  // DEL
                    if (!input.length) break;   // Don't remove characters past the input beginning!
                    input.pop();
                    process.stdout.write('\b \b'); // Remove one character from visible stdout
                    break;
                }
                default: {
                    input.push(buf.toString());
                    process.stdout.write(input[input.length - 1]);  // Echo the input
                }
            }
        }
        return input.join('');
    }
}

export class StackoweyInterpreter {
    #interactiveInputFunc = prompt;
    #inputIsInteractive = false;
    #halted = true;
    #inputbuf = [];
    #outputbuf = [];
    #devlog = [];
    #stack = new BigUint64Array(                    // Resizable 64-bit unsigned integer array...
        new ArrayBuffer(8, { maxByteLength: 0xffffffff })   // ...with the biggest supported size...
    );                                              // ...as the Stack
    #shebang = '#!/usr/bin/env -S ./stackowey -d';  // Default shebang line
    #codegrid = ['9'];                              // Just terminates immediately
    #cp = [0, 0];                                   // The top left corner
    #dir = Direction.RIGHT;                         // East

    #push(value = 0n) {
        this.#stack.buffer.resize(this.#stack.byteLength + this.#stack.BYTES_PER_ELEMENT);
        this.#stack[this.#stack.length - 1] = BigInt(value);
    }
    #read(index = 0) {
        if ((this.#stack.length > 0) && !(this.#stack.length <= index))
            return this.#stack[this.#stack.length - 1 - index];
        else
            return BigInt(Math.random() * Number(UINT64_MAX));
    }
    #pop() {
        if (this.#stack.length > 0) {
            const value = this.#read(0)
            this.#stack.buffer.resize(this.#stack.byteLength - this.#stack.BYTES_PER_ELEMENT);
            return value;
        } else
            return this.#read(-1);
    }

    #getInput() {
        // Consume the input buffer first; if that is empty, take user input; if that is impossible, halt.
        var line = '';
        if (this.#inputbuf.length) {
            line = this.#inputbuf.splice(0, 1); // Return the first line from the input buffer
        } else if (this.#inputIsInteractive) {
            line = this.#interactiveInputFunc();
        } else {
            this.#halted = true;
        }
        for (var i = 0; i < line.length; i++)
            this.#push(line.charCodeAt(i));
        this.#push(0);  // The extra 0
    }
    #output() {
        const char = this.#pop();
        // Output the character to the console
        if (isNode) process.stdout.write(String.fromCharCode(char));
        else console.log(String.fromCharCode(char));
        // Store the character in the output buffer
        if (char === 0x0a)  // LF
            this.#outputbuf.push('');   // Add a new line
        else
            this.#outputbuf[this.#outputbuf.length - 1] += String.fromCharCode(char);
    }

    get devlog() {
        return this.#devlog.join('\n');
    }

    get currentCommand() {
        return this.#codegrid[this.#cp[0]][this.#cp[1]];
    }

    get shebang() {
        return String(this.#shebang);
    }
    set shebang(line) {
        const stringline = String(line);
        if (stringline.startsWith('#!'))
            this.#shebang = stringline;
        else
            throw new Error('The shebang line must be a shebang line!');
    }

    get sourcecode() {
        return this.#codegrid.join('\n');
    }
    set sourcecode(code = '9') {
        this.#halted = true;
        const codelines = String(code).split('\n');
        if (codelines[codelines.length - 1].length == 0) codelines.pop(); // Discard the last line if it is empty
        const width = codelines[0]?.length || 0;
        for (const line of codelines) if (line.length != width) throw new Error('The eastward edge is too rough!');
        this.#codegrid = codelines;
        this.reset();
    }

    get friendlysource() {
        return this.sourcecode;
    }
    set friendlysource(code = '9') {
        this.#halted = true;
        const codelines = String(code).split('\n');
        if (codelines[codelines.length - 1].length == 0) codelines.pop(); // Discard the last line if it is empty
        var width = 0;
        for (const line of codelines) {
            if (line.length > width) width = line.length;
        }
        for (var i = 0; i < codelines.length; i++) {
            if (codelines[i].length < width)
                codelines[i] += ' '.repeat(width - codelines[i].length);
        }
        this.#codegrid = codelines;
        this.reset();
    }

    set io(line) {
        //TODO: Store character by character, to allow for appending to the last line if there already is one
        for (const l of String(line).split('\n'))
            this.#inputbuf.push(l);
    }
    get io() {
        const output = this.#outputbuf.join('\n');
        this.#outputbuf = [];
        return output;
    }

    reset() {
        this.#stack.buffer.resize(8);
        this.#stack[0] = 0o42n;
        this.#cp = [0, 0];
        this.#dir = Direction.RIGHT;
        this.#inputbuf = [];
        this.#halted = false;
    }

    constructor(code = '9', interactiveInput = false) {
        if (typeof interactiveInput === 'function') {
            this.#interactiveInputFunc = interactiveInput;
        }
        if (interactiveInput)
            this.#inputIsInteractive = true;

        const codelines = String(code).split('\n');
        if (codelines[0].startsWith('#!')) {
            this.#shebang = codelines[0];
            this.sourcecode = codelines.slice(1).join('\n');
        } else
            this.sourcecode = codelines.join('\n');
        this.reset();
    }

    step() {
        if (!this.#halted) {
            switch (this.currentCommand) {
                case '/': {
                    //TODO: Implement this!
                    break;
                }
                case '\\': {
                    //TODO: Implement this!
                    break;
                }
                case '?': {
                    //TODO: Implement this!
                    break;
                }
                case '!': {
                    //TODO: Implement this!
                    break;
                }
                case '%': {
                    //TODO: Implement this!
                    break;
                }
                case '0': {
                    //TODO: Implement this!
                    break;
                }
                case '1': {
                    //TODO: Implement this!
                    break;
                }
                case '2': {
                    //TODO: Implement this!
                    break;
                }
                case '3': {
                    //TODO: Implement this!
                    break;
                }
                case '4': {
                    //TODO: Implement this!
                    break;
                }
                case '5': {
                    //TODO: Implement this!
                    break;
                }
                case '6': {
                    //TODO: Implement this!
                    break;
                }
                case '7': {
                    //TODO: Implement this!
                    break;
                }
                case '+': {
                    //TODO: Implement this!
                    break;
                }
                case '_': {
                    //TODO: Implement this!
                    break;
                }
                case '#': {
                    //TODO: Implement this!
                    break;
                }
                case '@': {
                    //TODO: Implement this!
                    break;
                }
                case '.': {
                    //TODO: Implement this!
                    break;
                }
                case '8': {
                    //TODO: Implement this!
                    break;
                }
                case '9': {
                    //TODO: Implement this!
                    break;
                }
                default: {
                    // Impostor. Ignore.
                }
            }
            this.#dir = (this.#dir + 4) % 4; // Ensure the direction stays inside the 2D plane
            switch(this.#dir) {
                case Direction.RIGHT: {
                    this.#cp[1]++;  // Increment column number
                    break;
                }
                case Direction.DOWN: {
                    this.#cp[0]++;  // Increment line number
                    break;
                }
                case Direction.LEFT: {
                    this.#cp[1]--;  // Decrement column number
                    break;
                }
                case Direction.UP: {
                    this.#cp[0]--;  // Decrement line number
                    break;
                }
                default:
                    throw new Error('I\'m flat___. However, you should\'ve come better prepared.');
            }
        } else throw new Error('You can\'t get a dead mouse to run!');
    }

    run(steps = Infinity) {
        for (var stepCount = 0; (stepCount <= steps && !this.#halted); stepCount++)
            this.step();
    }
}
