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

const ErrorCode = Object.freeze({
    E_SUCCESS: 0,
    E_SYNTAX: 1,
    E_3D: 2,
    E_STREAM_R: 3,
    E_STREAM_W: 4,
    E_RUNTIME: 5,
    e_name(code) {
        for (const [e_name, e_code] of Object.entries(this))
            if (e_name.startsWith('E_') && e_code === code)
                return e_name;
        return 'E_UNKNOWN';
    },
    e_code(name) {
        return (name.startsWith('E_')) ? (this[name] || -1) : -1;
    }
});

class StackoweyError extends Error {
    constructor(e_code, msg) {
        super(msg);
        this.e_name = ErrorCode.e_name(e_code);
        this.e_code = Number(e_code);
        this.name = `${this.e_name}[${this.e_code}]`;
    }
}

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
    #interactiveInputFunc = ((isNode()) ? (() => prompt()) : (() => prompt('Stackowey needs your input: ')));
    #inputIsInteractive = false;
    #halted = true;
    #inputbuf = [];
    #outputbuf = [];
    #debug_info = [];
    #stack = new BigUint64Array(                    // Resizable 64-bit unsigned integer array...
        new ArrayBuffer(8, { maxByteLength: 0xffffffff })   // ...with the biggest supported size...
    );                                              // ...as the Stack
    #shebang = '#!/usr/bin/env -S ./stackowey -d';  // Default shebang line
    #playfield = ['9'];                             // Just terminates immediately
    #pos = [0, 0];                                  // The top left corner
    #dir = Direction.RIGHT;                         // East

    #push_stack(value = 0n) {
        this.#stack.buffer.resize(this.#stack.byteLength + this.#stack.BYTES_PER_ELEMENT);
        this.#stack[this.#stack.length - 1] = BigInt(value);
    }
    #read(index = 0) {
        if ((this.#stack.length > 0) && !(this.#stack.length <= index))
            return this.#stack[this.#stack.length - 1 - index];
        else
            return BigInt(Math.random() * Number(UINT64_MAX));
    }
    #pop_stack() {
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
            line = this.#inputbuf.splice(0, 1)[0];  // Return the first line from the input buffer
        } else if (this.#inputIsInteractive) {
            line = this.#interactiveInputFunc();
        } else {
            this.#halted = true;
        }
        for (var i = 0; i < line.length; i++)
            this.#push_stack(line.charCodeAt(i));
        this.#push_stack(0);    // The extra 0
    }
    #output() {
        const char = Number(this.#pop_stack());
        // Output the character to the console:
        if (isNode()) process.stdout.write(String.fromCharCode(char));
        else console.log(String.fromCharCode(char));
        // Store the character in the output buffer:
        if (char === 0x0a)  // LF
            this.#outputbuf.push('');   // Add a new line
        else
            if (!this.#outputbuf.length)
                this.#outputbuf.push(String.fromCharCode(char));    // Add the first line
            else
                this.#outputbuf[this.#outputbuf.length - 1] += String.fromCharCode(char);   // Add to the last line
    }

    get debug_info() {
        return this.#debug_info.join('\n');
    }

    get currentCommand() {
        //console.debug('Current coords: %d %d', this.#pos[0], this.#pos[1]);
        return this.#playfield[this.#pos[0]][this.#pos[1]];
    }

    get shebang() {
        return String(this.#shebang);
    }
    set shebang(line) {
        const stringline = String(line);
        if (stringline.startsWith('#!'))
            this.#shebang = stringline;
        else
            throw new StackoweyError(ErrorCode.E_SYNTAX, 'The shebang line must be a shebang line!');
    }

    get sourcecode() {
        return this.#playfield.join('\n');
    }
    set sourcecode(code = '9') {
        this.#halted = true;
        const codelines = String(code).split('\n');
        if (codelines[codelines.length - 1].length == 0) codelines.pop();   // Discard the last line if it is empty
        const width = codelines[0]?.length || 0;
        for (const line of codelines) if (line.length != width) throw new StackoweyError(ErrorCode.E_SYNTAX, 'The eastward edge is too rough!');
        this.#playfield = codelines;
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
        this.#playfield = codelines;
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
        this.#pos = [0, 0];
        this.#dir = Direction.RIGHT;
        this.#inputbuf = [];
        this.#outputbuf = [];
        this.#debug_info = [];
        this.#halted = false;
    }

    constructor(code = '9', interactiveInput = false) {
        if (typeof interactiveInput === 'function') {
            this.#interactiveInputFunc = interactiveInput;
        }
        if (interactiveInput)
            this.#inputIsInteractive = true;
        console.debug('interactiveInput:', interactiveInput, '\nthis.#interactiveInputFunc:', this.#interactiveInputFunc, '\nthis.#inputIsInteractive:', this.#inputIsInteractive);
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
            if (!(this.#playfield.length && this.#playfield[0].length)) throw new StackoweyError(ErrorCode.E_SYNTAX, 'Gimme nuffin\', get nuffin\'.');
            switch (this.currentCommand) {
                case '/': {
                    const values = [this.#pop_stack(), this.#pop_stack()];
                    if (values[0] > values[1]) {
                        if (this.#dir == Direction.RIGHT || this.#dir == Direction.LEFT)
                            this.#dir = (this.#dir + 1 + 4) % 4;    // +4 to avoid ever going negative
                        else
                            this.#dir = (this.#dir - 1 + 4) % 4;    // +4 to avoid ever going negative
                    } else {
                        // Ignore this potential turn
                    }
                    break;
                }
                case '\\': {
                    const values = [this.#pop_stack(), this.#pop_stack()];
                    if (values[0] < values[1]) {
                        if (this.#dir == Direction.RIGHT || this.#dir == Direction.LEFT)
                            this.#dir = (this.#dir - 1 + 4) % 4;    // +4 to avoid ever going negative
                        else
                            this.#dir = (this.#dir + 1 + 4) % 4;    // +4 to avoid ever going negative
                    } else {
                        // Ignore this potential turn
                    }
                    break;
                }
                case '?': {
                    this.#getInput();
                    break;
                }
                case '!': {
                    this.#output();
                    break;
                }
                case '%': {
                    this.#pos[0] = Number(this.#pop_stack());
                    this.#pos[1] = Number(this.#pop_stack());
                    break;
                }
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7': {
                    this.#push_stack(this.currentCommand);
                    break;
                }
                case '+': {
                    this.#push_stack(this.#pop_stack() + this.#pop_stack());
                    break;
                }
                case '_': {
                    this.#push_stack(~this.#pop_stack());
                    break;
                }
                case '#': {
                    if (!this.#stack.length) break;
                    const raw_i = Number(this.#pop_stack());
                    if (raw_i >= this.#stack.length) {
                        // Elements below the stack are random. Swapping with a random element is almost the same as just replacing the top value with a random one.
                        this.#pop_stack();  // This value gets swapped into the abyss and disappears
                        this.#push_stack(this.#read(-1));   // Generates a random number and pushes it to the stack
                        break;
                    }
                    const i = ((this.#stack.length - 1) - raw_i) % this.#stack.length;  // Choose a position inside the stack
                    const value_i = this.#stack[i];
                    this.#stack[i] = this.#pop_stack();
                    this.#push_stack(value_i);
                    break;
                }
                case '@': {
                    const raw_i = Number(this.#pop_stack());
                    if (raw_i >= this.#stack.length) {
                        this.#push_stack(this.#read(-1));   // Copying an element from below the stack is the same as just pushing a random value
                    }
                    const i = ((this.#stack.length - 1) - raw_i) % this.#stack.length;  // Choose a position inside the stack
                    this.#push_stack(this.#stack[i]);
                    break;
                }
                case '.': {
                    this.#pop_stack();
                    break;
                }
                case '=' {
                    this.#push_stack(this.#stack.length);
                }
                case '8': {
                    this.#push_stack(this.#pos[0]);
                    this.#push_stack(this.#pos[1]);

                    break;
                }
                case '9': {
                    this.#halted = true;
                    break;
                }
                default: {
                    // Impostor. Ignore.
                }
            }
            this.#dir = (this.#dir + 4) % 4; // Ensure the direction stays inside the 2D plane
            switch (this.#dir) {
                case Direction.RIGHT: {
                    this.#pos[1]++; // Increment column number
                    break;
                }
                case Direction.DOWN: {
                    this.#pos[0]--; // Decrement line number (Note: playfield is upside-down internally!)
                    break;
                }
                case Direction.LEFT: {
                    this.#pos[1]--; // Decrement column number
                    break;
                }
                case Direction.UP: {
                    this.#pos[0]++; // Increment line number (Note: playfield is upside-down internally!)
                    break;
                }
                default:
                    throw new StackoweyError(ErrorCode.E_SYNTAX, 'I\'m flat___. However, you should\'ve come better prepared.');
            }
            // Keep the coordinates inside the source code:
            this.#pos[0] = (this.#pos[0] + this.#playfield.length) % this.#playfield.length;
            this.#pos[1] = (this.#pos[1] + this.#playfield[0].length) % this.#playfield[0].length;
            // Adding the roll-over value above to prevent negatives
        } else throw new StackoweyError(ErrorCode.E_RUNTIME, 'You can\'t get a dead mouse to run!');
    }

    run(steps = Infinity) {
        var stepCount;
        try {
            for (stepCount = 0; (stepCount <= steps && !this.#halted); stepCount++)
                this.step();
        } catch (err) {
            console.debug(`Stackowey has crashed after being stepped ${stepCount} times!\n\n---------- Dev log: ----------\n${this.debug_info}\n\n---------- Error: ----------\n`, err);
        }
    }
}
