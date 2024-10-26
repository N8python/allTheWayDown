// model-worker.js
import {
    env,
    AutoTokenizer,
    AutoModelForCausalLM,
} from './transformers.js';

let tokenizer, model;

async function initializeModel() {
    env.localModelPath = 'models';
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.backends.onnx.wasm.numThreads = 2;

    tokenizer = await AutoTokenizer.from_pretrained('Cryptid-32M');
    model = await AutoModelForCausalLM.from_pretrained('Cryptid-32M', {
        dtype: "int8",
        device: "wasm",
        kv_cache_dtype: "float16",
        progress_callback: ({ progress }) => {
            self.postMessage({
                type: 'loading',
                data: { progress }
            });
        }
    });

    self.postMessage({ type: 'initialized' });
}

async function generateText(count, isNotification = false) {
    const input = tokenizer(Array(count).fill("<|bos|>"));
    const time = performance.now();

    const outputs = await model.generate({
        ...input,
        max_length: isNotification ? 64 : 128, // Shorter for notifications
        do_sample: true,
        temperature: isNotification ? 0.8 : 1.0, // Less random for notifications
        top_p: isNotification ? 0.95 : 0.9,
        repetition_penalty: isNotification ? 1.2 : 1.15 // Slightly higher for notifications
    });

    const endTime = performance.now();
    const outputTexts = tokenizer.batch_decode(outputs, { skip_special_tokens: false })
        .map(x => x.slice(7, x.indexOf("<|eos|>")));

    return {
        texts: outputTexts,
        time: endTime - time,
        tokens: outputs.ort_tensor.cpuData.length
    };
}

self.onmessage = async function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            await initializeModel();
            break;

        case 'generate':
            try {
                const result = await generateText(data.count, data.isNotification);
                self.postMessage({
                    type: 'generation-complete',
                    data: {
                        ...result,
                        isNotification: data.isNotification
                    }
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    error: error.message
                });
            }
            break;
        case 'generate-in-batch':
            //{ count: 20, batchSize: 2 }
            const { count, batchSize } = data;
            const batchCount = Math.ceil(count / batchSize);
            const results = [];

            for (let i = 0; i < batchCount; i++) {
                const batchResult = await generateText(batchSize);
                //results.push(batchResult);
                self.postMessage({
                    type: 'generation-complete',
                    data: batchResult
                });
            }

            /* self.postMessage({
                 type: 'generation-complete',
                 data: {
                     texts: results.flatMap(x => x.texts).slice(0, count),
                     time: results.reduce((acc, x) => acc + x.time, 0),
                     tokens: results.reduce((acc, x) => acc + x.tokens, 0)
                 }
             });*/
    }
};