/*
variables
*/
var model;
var canvas;
var classNames = [];
var canvas;
var coords = [];
var mousePressed = false;
var mode;

/*
prepare the drawing canvas 
*/
$(function() {
    canvas = window._canvas = new fabric.Canvas('canvas');
    canvas.backgroundColor = '#ffffff';
    canvas.isDrawingMode = 0;
    canvas.freeDrawingBrush.color = "black";
    canvas.freeDrawingBrush.width = 10;
	
	canvas.setWidth(800);
	canvas.setHeight(400);

    canvas.renderAll();
    //setup listeners 
    canvas.on('mouse:up', function(e) {
        getFrame();
        mousePressed = false
    });
    canvas.on('mouse:down', function(e) {
        mousePressed = true
    });
    canvas.on('mouse:move', function(e) {
        recordCoor(e)
    });
})

/*
set the table of the predictions 
*/
function setTable(top5, probs) {
    //loop over the predictions 
    /*for (var i = 0; i < top5.length; i++) {
        let sym = document.getElementById('sym' + (i + 1))
        let prob = document.getElementById('prob' + (i + 1))
        sym.innerHTML = top5[i]
        prob.innerHTML = Math.round(probs[i] * 100)
    }*/
   
   // Set Plot Title w/ Best Guess+Score 
	var p_title = '<h3>BEST 3 GUESSES:</h3>';
	p_title += '<ol><li>' + top5[0] + ' (' + Math.round(probs[0] * 100) + '%)</li>';
	p_title += '<li>' + top5[1] + ' (' + Math.round(probs[1] * 100) + '%)</li>';
	p_title += '<li>' + top5[2] + ' (' + Math.round(probs[2] * 100) + '%)</li></ol>';
	document.getElementById('results').innerHTML = p_title;
	
	var badge='';
	var prob_perc = probs[0] * 100;
	if (prob_perc >= 90) {
		badge = '<h3>Perfection!!!<h3>'
	} else if (prob_perc >= 80 && prob_perc <90) {
		badge = '<h3>Great!</h3>';
	} else if (prob_perc >= 65 && prob_perc <80) {
		badge = '<h3>Nice effort!</h3>';
	} else if (prob_perc >= 50 && prob_perc <65) {
		badge = '<h3>Not too bad! Keep going...</h3>';
	} else {
		badge = '<h3>ComeOn!, you can do it :-)</h3>';
	}
	document.getElementById('badge').innerHTML = badge;

}

/*
record the current drawing coordinates
*/
function recordCoor(event) {
    var pointer = canvas.getPointer(event.e);
    var posX = pointer.x;
    var posY = pointer.y;

    if (posX >= 0 && posY >= 0 && mousePressed) {
        coords.push(pointer)
    }
}

/*
get the best bounding box by trimming around the drawing
*/
function getMinBox() {
    //get coordinates 
    var coorX = coords.map(function(p) {
        return p.x
    });
    var coorY = coords.map(function(p) {
        return p.y
    });

    //find top left and bottom right corners 
    var min_coords = {
        x: Math.min.apply(null, coorX),
        y: Math.min.apply(null, coorY)
    }
    var max_coords = {
        x: Math.max.apply(null, coorX),
        y: Math.max.apply(null, coorY)
    }

    //return as strucut 
    return {
        min: min_coords,
        max: max_coords
    }
}

/*
get the current image data 
*/
function getImageData() {
        //get the minimum bounding box around the drawing 
        const mbb = getMinBox()

        //get image data according to dpi 
        const dpi = window.devicePixelRatio
        const imgData = canvas.contextContainer.getImageData(mbb.min.x * dpi, mbb.min.y * dpi,
                                                      (mbb.max.x - mbb.min.x) * dpi, (mbb.max.y - mbb.min.y) * dpi);
        return imgData
    }

/*
get the prediction 
*/
function getFrame() {
    //make sure we have at least two recorded coordinates 
    if (coords.length >= 2) {

        //get the image data from the canvas 
        const imgData = getImageData();

        //get the prediction 
        const pred = model.predict(preprocess(imgData)).dataSync();
		
		console.log(pred);
		
		
		 // Get top K res with index and probability
  const rawProbWIndex = pred.map((probability, index) => {
    return {
      index,
      probability
    }
  });
  
  console.log(rawProbWIndex);

        //find the top 5 predictions 
        const indices = findIndicesOfMax(pred, 5)
        const probs = findTopValues(pred, 5)
        const names = getClassNames(indices)
		
		console.log(probs)
		console.log(names);

        //set the table 
        setTable(names, probs)
    }

}

/*
get the the class names 
*/
function getClassNames(indices) {
    var outp = []
    for (var i = 0; i < indices.length; i++)
        outp[i] = classNames[indices[i]]
    return outp
}

/*
load the class names 
*/
async function loadDict() {

    loc = 'fdoodle/class_names.txt'
    
    await $.ajax({
        url: loc,
        dataType: 'text',
    }).done(success);
}

/*
load the class names
*/
function success(data) {
	console.log(data);
    const lst = data.split(/\n/)
    for (var i = 0; i < lst.length - 1; i++) {
        let symbol = lst[i]
        classNames[i] = symbol
    }
}

/*
get indices of the top probs
*/
function findIndicesOfMax(inp, count) {
    var outp = [];
    for (var i = 0; i < inp.length; i++) {
        outp.push(i); // add index to output array
        if (outp.length > count) {
            outp.sort(function(a, b) {
                return inp[b] - inp[a];
            }); // descending sort the output array
            outp.pop(); // remove the last index (index of smallest element in output array)
        }
    }
    return outp;
}

/*
find the top 5 predictions
*/
function findTopValues(inp, count) {
    var outp = [];
    let indices = findIndicesOfMax(inp, count)
    // show 5 greatest scores
    for (var i = 0; i < indices.length; i++)
        outp[i] = inp[indices[i]]
    return outp
}

/*
preprocess the data
*/
function preprocess(imgData) {
    return tf.tidy(() => {
        //convert to a tensor 
        let tensor = tf.browser.fromPixels(imgData, numChannels = 1)
        
        //resize 
        const resized = tf.image.resizeBilinear(tensor, [28, 28]).toFloat()
        
        //normalize 
        const offset = tf.scalar(255.0);
        const normalized = tf.scalar(1.0).sub(resized.div(offset));

        //We add a dimension to get a batch shape 
        const batched = normalized.expandDims(0)
        return batched
    })
}

/*
load the model
*/
async function start() {
    
    //load the model 
    model = await tf.loadLayersModel('fdoodle/model.json')
    
    //warm up 
    model.predict(tf.zeros([1, 28, 28, 1]))
    
    //allow drawing on the canvas 
    allowDrawing()
    
    //load the class names
    await loadDict()
}

/*
allow drawing on canvas
*/
function allowDrawing() {
    canvas.isDrawingMode = 1;
 
	document.getElementById('status').innerHTML = 'Ready to Draw';
   
    $('button').prop('disabled', false);
    var slider = document.getElementById('myRange');
    slider.oninput = function() {
        canvas.freeDrawingBrush.width = this.value;
    };
}

function resetResults() {
	document.getElementById('results').innerHTML = '';
	document.getElementById('badge').innerHTML = '';
}

/*
clear the canvs 
*/
function erase() {
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    coords = [];
	resetResults();
}
