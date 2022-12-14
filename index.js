var session;
var start_time;
var elapsed_time;

function log(msg) {
  let msg_node = document.getElementById('messages');
  msg_node.appendChild(document.createElement('br'));
  msg_node.appendChild(document.createTextNode(msg));
}

async function loadModel() {
  // Create an ONNX inference session with WebGL backend.
  // Can be 'cpu' or 'wasm'
  session = new onnx.InferenceSession({ backendHint: 'webgl' });
  
  // Load an ONNX model. This model is Resnet50 that takes a 1*3*224*224 image and classifies it.
  await session.loadModel("./resnet50_8.onnx");
  console.log("model loaded!")
  await imgSet();
}

async function imgSet() {
    let imageData = await WebDNN.Image.getImageArray(document.getElementById("image_url").value, {dstW: 224, dstH: 224});
    WebDNN.Image.setImageArrayToCanvas(imageData, 224, 224, document.getElementById('input_image'));
    document.getElementById('run_button').disabled = false;
    // log('Image loaded to canvas');
}

async function runExample() {
    // Load image.
    const imageLoader = new ImageLoader(imageSize, imageSize);
    const imageData = await imageLoader.getImageData(document.getElementById("image_url").value);
    // Preprocess the image data to match input dimension requirement, which is 1*3*224*224.
    const width = imageSize;
    const height = imageSize;

    start_time = performance.now();
    const preprocessedData = preprocess(imageData.data, width, height);

    //const inputTensor = new onnx.Tensor(preprocessedData, 'float32', [1, 3, width, height]);
    // Run model with Tensor inputs and get the result.
    const outputMap = await session.run(preprocessedData);
    const outputData = outputMap.values().next().value.data;
    console.log(outputData);
    // Render the output result in html.
    printMatches(outputData);
  }
  
  /**
   * Preprocess raw image data to match Resnet50 requirement.
   */
  function preprocess(data, width, height) {

    // image to tensor
    let imgData = new Float32Array(data);
    let input = new Float32Array(width * height * 3).fill(1.0);
    let count = 0
    for (i=0; i<imgData.length; i+=4){
        input[count] = (imgData[i]/255 - 0.485)/0.229;
        count += 1;
    }
    for (i=0; i<imgData.length; i+=4){
        input[count] = (imgData[i+1]/255 - 0.456)/0.224;
        count += 1;
    }
    for (i=0; i<imgData.length; i+=4){
        input[count] = (imgData[i+2]/255 - 0.406)/0.225;
        count += 1;
    }
    input = [new Tensor(input, "float32", [1, 3, width, height])];
    console.log(input);


    // const dataFromImage = ndarray(new Float32Array(data), [width, height, 4]);
    // const dataProcessed = ndarray(new Float32Array(width * height * 3), [1, 3, height, width]);
  
    // // Normalize 0-255 to (-1)-1
    // ndarray.ops.divseq(dataFromImage, 128.0);
    // ndarray.ops.subseq(dataFromImage, 1.0);
  
    // // Realign imageData from [224*224*4] to the correct dimension [1*3*224*224].
    // ndarray.ops.assign(dataProcessed.pick(0, 0, null, null), dataFromImage.pick(null, null, 2));
    // ndarray.ops.assign(dataProcessed.pick(0, 1, null, null), dataFromImage.pick(null, null, 1));
    // ndarray.ops.assign(dataProcessed.pick(0, 2, null, null), dataFromImage.pick(null, null, 0));
  
    //return dataProcessed.data;

    return input
  }
  
  /**
   * Utility function to post-process Resnet50 output. Find top k ImageNet classes with highest probability.
   */
  function imagenetClassesTopK(classProbabilities, k) {
    if (!k) { k = 5; }
    const probs = Array.from(classProbabilities);
    const probsIndices = probs.map(
      function (prob, index) {
        return [prob, index];
      }
    );
    const sorted = probsIndices.sort(
      function (a, b) {
        if (a[0] < b[0]) {
          return -1;
        }
        if (a[0] > b[0]) {
          return 1;
        }
        return 0;
      }
    ).reverse();
    const topK = sorted.slice(0, k).map(function (probIndex) {
      const iClass = imagenetClasses[probIndex[1]];
      return {
        id: iClass[0],
        index: parseInt(probIndex[1], 10),
        name: iClass[1].replace(/_/g, ' '),
        probability: probIndex[0]
      };
    });
    return topK;
  }
  
  /**
   * Render Resnet50 output to Html.
   */
  function printMatches(data) {
    let outputClasses = [];
    if (!data || data.length === 0) {
      const empty = [];
      for (let i = 0; i < 5; i++) {
        empty.push({ name: '-', probability: 0, index: 0 });
      }
      outputClasses = empty;
    } else {
      outputClasses = imagenetClassesTopK(data, 5);
    }
    const predictions = document.getElementById('predictions');
    predictions.innerHTML = '';
    const results = [];
    for (let i of [0, 1, 2, 3, 4]) {
      results.push(`${outputClasses[i].name}: ${Math.round(100 * outputClasses[i].probability)}%`);
    }
    elapsed_time = performance.now() - start_time;
    results.push(`Time taken: ${elapsed_time.toFixed(2)}ms`);
    predictions.innerHTML = results.join('<br/>');
  }
  