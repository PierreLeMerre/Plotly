// A an example visualization of adult mouse gene expression data using the D3 
// partition and radial layouts.

// This uses the Modernizr JS library to check to see if the page supports SVG.
// If it does not, throw an error.
if (!Modernizr.svg){
	$('#chart').append(
		$('<div>').addClass('svgError')
			.html("This demo requires SVG support. " +
				  "Click <a href='http://caniuse.com/#cats=SVG'>here</a> " + 
				  "to see which browsers support SVG."));
	throw 'SVG not supported';
}

// Set default SectionDataSetId. Then parse the  parameter string and load a 
// specified id if requested. 
var sectionDataSetId = 01; 

var urlVars = getUrlVars();
if ('id' in urlVars)
	sectionDataSetId =  urlVars['id'];

// Constants defining various parameters of the visualization.
//
// * `w,h`: width/height of the visualization in pixels.
// * `r`: the radius of the vis. in pixels.
// * `outerWidth`: how many pixels to reserve for the bar chart.

var w = $("#chart").width();
var h = $("#chart").height();
var r = Math.min(w, h) / 2;
var outerWidth = r/3.5;
var expDomain = [0,5];
var rootNode = null;
var expressionHash = null;
var numberHash = null;
var ratioHash = null;

// D3 scales, which interpolate linearly from a domain (default [0,1], unless 
// specified) to a range (also default [0,1]).  The `x` scale maps from D3's
// normalized layout coordinates to radians.  The `y` scale similarly maps
// to radial pixel distance from the origin of the plot.  The `yOut` scale
// is also for radial pixel distance, this time for the expression bar chart
// around the outside of the ontology.  

var x = d3.scale.linear().range([0, 2 * Math.PI]);
var y = d3.scale.linear().range([0, Math.pow((r - .5 * outerWidth) / r, 2) * r]);
var yOut = d3.scale.linear().domain(expDomain).range([r - outerWidth, r]).clamp(true);
//var expcolor = d3.scale.linear().domain(expDomain).range(["#eee", "red"]);
var expcolor = d3.scale.linear().domain(expDomain).range(["white", "black"]);
//var highlightcolor = d3.scale.linear().domain(expDomain).range(["#eee", "#fdd"]);
var highlightcolor = d3.scale.linear().domain(expDomain).range(["Tan", "Tan"]);

// Initialize page elements.  Most important, in this section the scale button
// options are initialized.  This allows the arcs depicting both ontological 
// structures and gene expression values to be scaled by gene expression magnitude
// or uniformly.
$("#chart").css("background","no-repeat center url(\"../loading.gif\")");
$("#homeButton").button({ icons: { primary: "ui-icon-home" }});

var structureLabel = $("#structureLabel");
var expressionLabel = $("#expressionLabel");
var numberLabel = $("#numberLabel");
var ratioLabel = $("#ratioLabel");
var scaleButtonContainer = $("#scaleButtons");

var scaleOptions = [{ name: 'expression', id: "#expressionButton", fn: expressionValue },
					{ name: 'number', id: "#numberButton", fn: numberValue },
					{ name: 'ratio', id: "#ratioButton", fn: ratioValue },
					{ name: 'uniform', id: "#uniformButton", fn: uniformValue }];
//var scaleOptions = [{ name: 'uniform', id: "#uniformButton", fn: uniformValue },
//					{ name: 'expression', id: "#expressionButton", fn: expressionValue }];

/*for (var i = 0; i < scaleOptions.length; i++) {
	var opt = scaleOptions[i].name;
	scaleButtonContainer.append($(document.createElement('input'))
								.attr('type', 'radio')
								.attr('id', opt + 'Button')
								.attr('name', 'scaleRadio')
								.attr('value', opt)
								.attr('checked', opt == 'uniform'));
								//mod 07-11
								//.attr('checked', opt == 'expression'));

	scaleButtonContainer.append($(document.createElement('label'))
								.attr('for', opt + 'Button')
								.html(opt));
}

scaleButtonContainer.buttonset();
*/
// These functions are used by D3 to determine how large data arcs should be.
//function uniformValue(d) { return 1; }
function uniformValue(d) { 
	var eout = expressionHash[d.id]; 
	return eout ? eout : 0; 
}

// If the expression hash doesn't contain a particular structure id, for 
// visualization purposes treat the structure as having no expression energy.
function expressionValue(d) { 
	var eout = expressionHash[d.id]; 
	return eout ? eout : 0; 
}

function numberValue(d) { 
	var eout = numberHash[d.id]; 
	return eout ? eout : 0; 
}

function ratioValue(d) { 
	var eout = ratioHash[d.id]; 
	return eout ? eout : 0; 
}

// Construct the main svg element, size it properly, and apply a global 
// transform shifts the origin to the center.
var vis = d3.select("#chart").append("svg:svg")
	.attr("id","vis")
	.attr("width", w)
	.attr("height", h)
	.append("svg:g")
	.attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");

// This is the D3 partition layout.  It takes a hierarchical hash and 
// determines the relative proportion of children and their parents
// in normalized coordinates [0,1].
var partition = d3.layout.partition()
	.sort(function(a,b) { return b.graph_order - a.graph_order; })
	.value(uniformValue);
	// mod 07-11
	//.value(expressionValue);
// This arc map takes normalized layout coordinates, maps them to radians and
// radial pixel distance, then converts this to an actual SVG primitive.
var arc = d3.svg.arc()
	.startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
	.endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
	.innerRadius(function(d) { return (d.children.length == 0) ? r - outerWidth : Math.max(0, y(d.y)); })
	.outerRadius(function(d) { return (d.children.length == 0) ? yOut(expressionValue(d)) : Math.max(0, y(d.y + d.dy)); });

// Same as above, except for use in the gene expression bar chart.
var arcHighlight = d3.svg.arc()
	.startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
	.endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
	.innerRadius(function(d) { return (d.children.length == 0) ? r - outerWidth : Math.max(0, y(d.y + d.dy)); })
	.outerRadius(function(d) { return r; });

// Finally load the data and transform it into a D3-partition-able format.
importData(sectionDataSetId, function(structureTree, expression, number, ratio) {
	rootNode = structureTree;
	expressionHash = expression;
	numberHash = number;
	ratioHash = ratio;

	$("#chart").css("background", "");

	// The mouseover highlight goes first, so that the actual visualization 
	// elements will be drawn on top due to z-ordering.
	var highlight = vis.append("svg:path")
		.attr("d", null)
		.style("fill", "#eee");

	// The most important bit of code: this lays out the actual arcs, both for
	// the ontology and the bar chart.  `vis` is the chart div defined in the 
	// HTML. Calling the `data` function does a data join of a single element 
	// (the ontology).  The `selectAll` call searches for any existing class 
	// "dataArc" elements within the chart and assigns them a function 
	// (`partition.nodes`), which maps the `structureTree` ontology into an 
	// array of tree nodes. The `enter` function creates a callback for what 
	// to do for each of these new data nodes, which we use to create new SVG 
	// path primitives.  The properties of these primites are then defined.
	var path = vis.data([structureTree]).selectAll("dataArc")
		.data(partition.nodes)
		.enter().append("svg:path")
		.attr("d", arc)
		.style("fill", arcColor)
		.style("stroke", arcStroke)
		.style("stroke-width", arcStrokeWidth)
		.on("click", click)
		.on("mouseover", mouseover)
		.on("mouseout", mouseout)
		.each(stash);

	// When the user mouses over a node, the properties of that node are displayed
	// on the page and highlighted.  When the mouse leaves a node, these things are
	// erased.  

	function mouseover(d) { 
		highlight.attr("d", arcHighlight(d));
		highlight.style("fill", (d.children.length > 0) ? highlightcolor(expressionValue(d)) : "Tan")
		//highlight.style("fill", (d.children.length > 0) ? highlightcolor(expressionValue(d)) : "#eee")
		//structureLabel.html(d.name);
		structureLabel.html(d.acronym);
		expressionLabel.html(expressionValue(d));
		numberLabel.html(numberValue(d));	
		ratioLabel.html(ratioValue(d));
	}


	function mouseout(d) {
		highlight.attr("d", null);
		highlight.style("fill", "#fff");
		structureLabel.html("");
		expressionLabel.html("");
		numberLabel.html("");
		ratioLabel.html("");
	}

	// When a node is clicked, an interesting transition happens.  The `arcTween`
	// method describes what happens during that transition.  *Note:* the `arcTween`
	// method is called with the clicked node, which returns a function, so the
	// `attrTween` callback is the return value of `arcTween` (which depends on
	// the position of the new root node).
	function click(d,i) {
		if (d.children.length > 0) {
			rootNode = d;

			highlight.attr("d", null);
			structureLabel.html("");
			expressionLabel.html("");
			numberLabel.html("");
			ratioLabel.html("");
			path.transition()
				.duration(750)
				.attrTween("d", arcTween(rootNode));
		}
	}

	// These buttons re-layout the entire chart based on whether ontology leafs
	// are scaled in proportion to their expression energy or if they all
	// take up the same amount of space.  The transition is taken care of
	// by the `dataTween` function.  *As before:* the `attrTween` callback is
	// the return value of the `dataTween` method.
	$.each(scaleOptions, function(i,button) {
		$(button.id).click(function() { dataTransition(button.fn); });
	});

	function dataTransition(valueFunction) {
		path.data(partition.value(valueFunction))
			.style("fill", arcColor)
			.style("stroke", arcStroke)
			.style("stroke-width", arcStrokeWidth)
			.transition()
			.duration(750)
			.attrTween("d", dataTween(rootNode));
	}

	// Several functions that determine how the data nodes are displayed.
	// If the nodes are leaves, they are colored by their z-score.  Otherwise
	// they are colored using ontological colors.
	function arcColor(d) {
		return (d.children.length > 0) ? 
			"#" + d.color_hex_triplet : 
			expcolor(expressionValue(d));
	}

	function arcStroke(d) {
		return (d.children.length > 0) ? "#fff" : "none";
	}

	function arcStrokeWidth(d) {
		return "1px";
	}					   

	// This function returns a callback used by D3's `attrTween` method to 
	// transition the arcs so that a new node is the (visible) root of the ontology.
	// This is done by changing the domain and range `x` and `y` scales.

	// The first three variables are scale interpolators. The x domain normally 
	// spans [0,1], but we're going to transition it to the x range of `d`. The same
	// applies for `y`, which will be transitioned to the center.  The `y` range 
	// interpolator ensures that the parent of the clicked node shows up in the center.
	function arcTween(root) {

		var xd = d3.interpolate(x.domain(), [root.x, root.x + root.dx]);
		var yd = d3.interpolate(y.domain(), [root.y, 1]);
		var yr = d3.interpolate(y.range(), [root.y ? 20 : 0, r - outerWidth]);
		
		// For each node, return an interpolator function that D3 can use to transition.
		// The scales only need to be modified once per transition step, so only do this
		// when i = 0. In all cases the interpolator just re-applies the arc function,
		// which uses our newly updated scales to produce new curves.
		return function(d, i) {
			return i
				? function(t) { return arc(d); }
		    : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
		};
	}

	// Cache the current location of an element.
	function stash(d) {
		d.x0 = d.x;
		d.dx0 = d.dx;
	}

	// This is a slightly more complicated transition, called when the data scaling
	// variable has changed.  This means all of the nodes have new positions and 
	// widths, so we transition node position from cached values to new values. 
	// We also need to transition the domain of the `x` scale because the root 
	// node `r` has a new position as well.
	function dataTween(r) {
		var xd = d3.interpolate(x.domain(), [r.x, r.x + r.dx]);

		return function(d, i) {
			var arci = d3.interpolate({x: d.x0, dx: d.dx0}, d);

			// the domain only gets updated once.
			if (i == 0) {
				return function(t) {
					x.domain(xd(t));

					var b = arci(t);
					d.x0 = b.x;
					d.dx0 = b.dx;
					return arc(b);
				}
			} else {
				return function(t) {
					var b = arci(t);
					d.x0 = b.x;
					d.dx0 = b.dx;
					return arc(b);
				}
			}
		};
	}
});

// This function splits the URL parameter string into a javascript hash.
function getUrlVars()
{
	var vars = [], hash;
	var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
	for(var i = 0; i < hashes.length; i++)
	{
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}
	return vars;
}