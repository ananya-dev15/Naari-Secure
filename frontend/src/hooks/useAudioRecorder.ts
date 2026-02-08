import { useRef, useCallback } from 'react';

const useAudioRecorder = () => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        console.log("[AUDIO] startRecording called");
        try {
            // Check if already recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                console.warn("[AUDIO] Already recording, ignoring start request");
                return;
            }

            console.log("[AUDIO] Requesting microphone for recording...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Check supported types
            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            console.log(`[AUDIO] Using MIME type: ${mimeType}`);
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    console.log(`[AUDIO] Data chunk received: ${e.data.size} bytes`);
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onerror = (event: any) => {
                console.error("[AUDIO] MediaRecorder Error:", event.error);
            };

            mediaRecorder.start(1000); // Collect data every second for safety
            console.log("[AUDIO] MediaRecorder started successfully, state:", mediaRecorder.state);
        } catch (err) {
            console.error("[AUDIO] CRITICAL: Error starting recording:", err);
        }
    }, []);

    const stopAndUpload = useCallback(async (token: string) => {
        console.log("[AUDIO] stopAndUpload called");
        return new Promise<void>((resolve, reject) => {
            if (!mediaRecorderRef.current) {
                console.warn("[AUDIO] No mediaRecorder instance found to stop");
                resolve();
                return;
            }

            if (mediaRecorderRef.current.state === 'inactive') {
                console.warn("[AUDIO] MediaRecorder is already inactive");
                resolve();
                return;
            }

            mediaRecorderRef.current.onstop = async () => {
                console.log(`[AUDIO] Recording stopped. Total chunks: ${chunksRef.current.length}`);

                if (chunksRef.current.length === 0) {
                    console.error("[AUDIO] No data chunks collected. Cannot upload.");
                    resolve();
                    return;
                }

                const audioBlob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
                console.log(`[AUDIO] Final Blob size: ${audioBlob.size} bytes`);

                const formData = new FormData();
                // Use .webm as default but .mp4 for Safari
                const extension = (mediaRecorderRef.current?.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
                formData.append('audio', audioBlob, `sos-recording.${extension}`);

                try {
                    console.log("[AUDIO] Uploading to backend...");
                    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sos/upload-audio`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(`Server responded with ${res.status}: ${errorText}`);
                    }

                    const data = await res.json();
                    console.log("[AUDIO] Upload success! Filename:", data.filename);
                    resolve();
                } catch (err) {
                    console.error("[AUDIO] Upload FAILED:", err);
                    reject(err);
                } finally {
                    console.log("[AUDIO] Cleaning up tracks...");
                    mediaRecorderRef.current?.stream.getTracks().forEach(track => {
                        track.stop();
                        console.log(`[AUDIO] Track ${track.label} stopped`);
                    });
                    mediaRecorderRef.current = null;
                }
            };

            mediaRecorderRef.current.stop();
            console.log("[AUDIO] stop() command sent to MediaRecorder");
        });
    }, []);

    return { startRecording, stopAndUpload };
};

export default useAudioRecorder;
