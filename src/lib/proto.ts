
export const ProtobufUtil = {
    // Simple writer for known fields: 1 (string), 3 (string), 5 (string)
    encodeAuth: (userId: string, sessionKey: string, token: string): Uint8Array => {
        const writer = new BinaryWriter();

        // Field 1: User ID
        writer.writeString(1, userId);

        // Field 3: Session Key
        writer.writeString(3, sessionKey);

        // Field 5: Token
        writer.writeString(5, token);

        return writer.getResult();
    },

    encodeOrderbook: (userId: string, symbols: string[], sessionKey: string, token: string): Uint8Array => {
        const writer = new BinaryWriter();

        // Field 1: User ID
        writer.writeString(1, userId);

        // Field 2: Nested Subscription Details
        const nestedWriter = new BinaryWriter();
        for (const symbol of symbols) {
            // Topic A (Field 2)
            nestedWriter.writeString(2, symbol);
        }
        for (const symbol of symbols) {
            // Topic B (Field 6)
            nestedWriter.writeString(6, symbol);
        }
        for (const symbol of symbols) {
            // Topic C (Field 7)
            nestedWriter.writeString(7, symbol);
        }
        for (const symbol of symbols) {
            // Topic D (Field 9)
            nestedWriter.writeString(9, symbol);
        }

        // Write the nested message as bytes to Field 2 of outer message
        writer.writeBytes(2, nestedWriter.getResult());

        // Field 3: Session Key
        writer.writeString(3, sessionKey);

        // Field 5: Token
        writer.writeString(5, token);

        return writer.getResult();
    },

    encodeRunningTrade: (userId: string, symbols: string | string[] | null, sessionKey: string, token: string): Uint8Array => {
        const writer = new BinaryWriter();

        // Field 1: User ID
        writer.writeString(1, userId);

        // Field 2: Nested - Topic 5 (Trades)
        const nestedWriter = new BinaryWriter();

        const symbolList = Array.isArray(symbols)
            ? symbols
            : (symbols && symbols !== "*" ? symbols.split(",").map(s => s.trim().toUpperCase()).filter(s => s) : []);

        if (symbolList.length === 0) {
            // Default: All trades
            nestedWriter.writeString(5, "*");
        } else {
            // Filtered: Use '*' in field 5 and list symbols in field 6 (matching user dump)
            nestedWriter.writeString(5, "*");
            for (const sym of symbolList) {
                nestedWriter.writeString(6, sym);
            }
        }

        writer.writeBytes(2, nestedWriter.getResult());

        // Field 3: Session Key
        writer.writeString(3, sessionKey);

        // Field 5: Token
        writer.writeString(5, token);

        return writer.getResult();
    },

    decodeMarketData: (buffer: Uint8Array): { symbol?: string, data?: string }[] => {
        type DecodedRow = {
            symbol?: string;
            data?: string;
            price?: number;
            volume?: number;
            sideVal?: number;
        };
        const results: DecodedRow[] = [];
        const reader = new BinaryReader(buffer);

        const readDouble = (bytes: Uint8Array) => {
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            return view.getFloat64(0, true);
        };

        // Context: 'root', 'field8_batch', 'field9_single', 'trade_item'
        function parse(r: BinaryReader, context: string, current: DecodedRow | null) {
            while (!r.isAtEnd()) {
                const tag = r.readTag();

                if (tag.wireType === 2) {
                    const bytes = r.readBytes();

                    if (tag.fieldNumber === 8) {
                        // Batch Container (Field 8)
                        // Contains repeated Field 1s (Trade Items)
                        // We create a temporary reader for this block
                        parse(new BinaryReader(bytes), 'field8_batch', null);
                    }
                    else if (tag.fieldNumber === 9 || tag.fieldNumber === 10) {
                        // Single Update Container (Field 9 or 10)
                        // Usually maps to ONE update. We use the current object (or create one if root)
                        let target = current;
                        if (!target && context === 'root') {
                            target = {};
                            results.push(target);
                        }
                        parse(new BinaryReader(bytes), 'field9_single', target);
                    }
                    else if (tag.fieldNumber === 1) {
                        if (context === 'field8_batch') {
                            // In Batch mode, Field 1 is a Trade Item Wrapper
                            const newItem: DecodedRow = {};
                            results.push(newItem);
                            parse(new BinaryReader(bytes), 'trade_item', newItem);
                        } else if (context === 'field9_single' || context === 'root') {
                            // In Single mode, Field 1 is Symbol (String)
                            const s = new TextDecoder().decode(bytes);
                            if (current) current.symbol = s;
                        } else {
                            // Recurse for safety? Or treat as string?
                            // In trade_item, Field 1 might be meta info, let's ignore or recurse safely if needed
                            // For now, assume it's not the symbol if we are in trade_item
                        }
                    }
                    else if (tag.fieldNumber === 2) {
                        const s = new TextDecoder().decode(bytes);
                        if (s.startsWith("#")) {
                            if (current) current.data = s;
                        } else {
                            // In trade_item, Field 2 is Symbol
                            // In field9_single, Field 2 is NOT Symbol (it's Price Fixed64, handled in wireType 1 usually, but if wireType 2 it's string/bytes)
                            if (context === 'trade_item' && current) {
                                current.symbol = s;
                            } else if (context === 'field9_single' && current && !current.symbol) {
                                // Fallback
                                current.symbol = s;
                            }
                        }
                    }
                } else if (tag.wireType === 1) {
                    const bytes = r.readFixed64();
                    const val = readDouble(bytes);
                    if (current) {
                        if (context === 'trade_item') {
                            if (tag.fieldNumber === 3) current.price = val;
                            if (tag.fieldNumber === 4) current.volume = val;
                        } else if (context === 'field9_single') {
                            if (tag.fieldNumber === 2) current.price = val; // New format
                            if (tag.fieldNumber === 3) current.price = val; // Old format fallback
                            if (tag.fieldNumber === 4) current.volume = val;
                        }
                    }
                } else if (tag.wireType === 0) {
                    const val = r.readVarint();
                    if (current && tag.fieldNumber === 5) {
                        current.sideVal = val;
                    }
                } else {
                    r.skipType(tag.wireType);
                }
            }
        }

        parse(reader, 'root', null);

        // Post-process results to ensure they have the #T format data if missing
        return results.map(r => {
            if (r.symbol && (r.price || 0) > 0 && !r.data) {
                return {
                    ...r,
                    data: `#T|${r.symbol}|${r.price}|${r.volume || 0}|${r.sideVal || 0}`
                };
            }
            return r;
        });
    }
};

class BinaryReader {
    private offset: number = 0;
    private view: DataView;

    constructor(buffer: Uint8Array) {
        this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    isAtEnd(): boolean {
        return this.offset >= this.view.byteLength;
    }

    readTag(): { fieldNumber: number, wireType: number } {
        const tag = this.readVarint();
        return {
            fieldNumber: tag >>> 3,
            wireType: tag & 7
        };
    }

    readVarint(): number {
        let value = 0;
        let shift = 0;
        while (true) {
            if (this.offset >= this.view.byteLength) throw new Error("Unexpected end of data");
            const byte = this.view.getUint8(this.offset++);
            value |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
        }
        return value;
    }

    readBytes(): Uint8Array {
        const length = this.readVarint();
        if (this.offset + length > this.view.byteLength) throw new Error("Buffer overflow");
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
        this.offset += length;
        return bytes;
    }

    readFixed64(): Uint8Array {
        if (this.offset + 8 > this.view.byteLength) throw new Error("Buffer overflow");
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, 8);
        this.offset += 8;
        return bytes;
    }

    skipType(wireType: number) {
        if (wireType === 0) this.readVarint();
        else if (wireType === 1) this.offset += 8;
        else if (wireType === 2) {
            const len = this.readVarint();
            this.offset += len;
        } else if (wireType === 5) this.offset += 4;
    }
}

class BinaryWriter {
    private buffer: number[] = [];

    writeString(fieldNumber: number, value: string) {
        const tag = (fieldNumber << 3) | 2; // Wire type 2 for length-delimited (string)
        this.writeVarint(tag);

        const bytes = new TextEncoder().encode(value);
        this.writeVarint(bytes.length);
        for (const byte of bytes) {
            this.buffer.push(byte);
        }
    }

    writeBytes(fieldNumber: number, value: Uint8Array) {
        const tag = (fieldNumber << 3) | 2;
        this.writeVarint(tag);
        this.writeVarint(value.length);
        for (const byte of value) {
            this.buffer.push(byte);
        }
    }

    writeVarint(value: number) {
        while (value > 127) {
            this.buffer.push((value & 127) | 128);
            value >>>= 7;
        }
        this.buffer.push(value);
    }

    getResult(): Uint8Array {
        return new Uint8Array(this.buffer);
    }
}
