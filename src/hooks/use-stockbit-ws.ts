"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ProtobufUtil } from "@/lib/proto";

const buf2hex = (buffer: Uint8Array) => {
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, "0"))
        .join(" ");
};

type ConnectionStatus = "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED" | "ERROR";

export function useStockbitWebSocket({
    token,
    defaultUrl = "wss://wss-jkt.trading.stockbit.com/ws",
}: { token: string; defaultUrl?: string }) {
    const [url, setUrl] = useState(defaultUrl);
    const [status, setStatus] = useState<ConnectionStatus>("CLOSED");
    const [lastMessage, setLastMessage] = useState<any>(null);
    const [lastBatch, setLastBatch] = useState<any[]>([]);
    const [messageHistory, setMessageHistory] = useState<any[]>([]);
    const socketRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        if (!token || !url) return;
        if (socketRef.current?.readyState === WebSocket.OPEN) return;

        try {
            setStatus("CONNECTING");
            console.log(`Connecting to ${url}...`);
            const socket = new WebSocket(url);
            socketRef.current = socket;

            socket.onopen = () => {
                setStatus("OPEN");
                console.log("Stockbit WS Connected");

                // Authenticate immediately removed to allow manual payload sending
                // const authMessage = {
                //     type: "authenticate",
                //     token: token,
                // };
                // socket.send(JSON.stringify(authMessage));
            };

            socket.onmessage = async (event) => {
                let msgs: any[] | null = null;
                let msg: any = null;
                try {
                    if (event.data instanceof Blob) {
                        const buffer = await event.data.arrayBuffer();
                        const uint8 = new Uint8Array(buffer);
                        try {
                            const decodedList = ProtobufUtil.decodeMarketData(uint8);
                            if (decodedList.length > 0) {
                                msgs = decodedList;
                            } else {
                                msgs = [{
                                    raw: "Binary data (unknown format)",
                                    length: uint8.length,
                                    hex: buf2hex(uint8)
                                }];
                            }
                        } catch (e) {
                            msgs = [{
                                raw: "Binary decode error",
                                error: String(e),
                                hex: buf2hex(uint8)
                            }];
                        }
                    } else if (event.data instanceof ArrayBuffer) {
                        const uint8 = new Uint8Array(event.data);
                        try {
                            const decodedList = ProtobufUtil.decodeMarketData(uint8);
                            if (decodedList.length > 0) {
                                msgs = decodedList;
                            } else {
                                msgs = [{
                                    raw: "Binary data (unknown format)",
                                    length: uint8.length,
                                    hex: buf2hex(uint8)
                                }];
                            }
                        } catch (e) {
                            msgs = [{
                                raw: "Binary decode error",
                                error: String(e),
                                hex: buf2hex(uint8)
                            }];
                        }
                    } else if (typeof event.data === 'string') {
                        if (event.data.startsWith('a["') && event.data.endsWith('"]')) {
                            const inner = JSON.parse(event.data.slice(1));
                            if (Array.isArray(inner) && inner.length > 0) {
                                try {
                                    msg = JSON.parse(inner[0]);
                                } catch {
                                    msg = inner[0];
                                }
                            } else {
                                msg = inner;
                            }
                        } else {
                            try {
                                msg = JSON.parse(event.data);
                            } catch {
                                msg = event.data;
                            }
                        }
                    } else {
                        msg = { raw: "Unknown data type", type: typeof event.data };
                    }
                } catch (e) {
                    console.error("Failed to parse message", e);
                    msg = { raw: "Parse error", error: String(e) };
                }

                if (!msgs) {
                    if (msg) msgs = [msg];
                    else return;
                }

                if (Array.isArray(msgs)) {
                    // Filter out empty/invalid messages if necessary
                    const validMsgs = msgs.map(m => ({ ...m, timestamp: Date.now() }));

                    if (validMsgs.length > 0) {
                        // Store in history (limit to 200 for now)
                        setMessageHistory((prev) => [...validMsgs, ...prev].slice(0, 200));

                        // Update last message with the latest one for hooks that depend on it
                        // We picking the last one in the batch as "latest"
                        setLastMessage(validMsgs[validMsgs.length - 1]);
                        setLastBatch(validMsgs);
                    }
                }
            };

            socket.onclose = (event) => {
                setStatus("CLOSED");
                console.log("Stockbit WS Closed", event.code, event.reason);
            };

            socket.onerror = (error) => {
                setStatus("ERROR");
                console.error("Stockbit WS Error", error);
            };
        } catch (err) {
            console.error("Failed to initiate websocket", err);
            setStatus("ERROR");
        }
    }, [token, url]);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
            setStatus("CLOSED");
        }
    }, []);

    const sendMessage = useCallback((msg: any) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            let payload;
            if (typeof msg === "string") {
                payload = msg;
            } else if (msg instanceof Uint8Array || msg instanceof ArrayBuffer) {
                payload = msg;
            } else {
                payload = JSON.stringify(msg);
            }
            socketRef.current.send(payload);
        } else {
            console.warn("Cannot send message, socket not open");
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    return {
        url,
        setUrl,
        connect,
        disconnect,
        status,
        lastMessage,
        lastBatch,
        messageHistory,
        sendMessage,
    };
}
