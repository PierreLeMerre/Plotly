var rootId = 8;
var ontologyId = 1; 
var structureGraphId = 1;
function importData(id, callback) {
	var structures = null;
	var expression = null;
	var number = null;
	var ratio = null;

	var url = "https://github.com/PierreLeMerre/Plotly/Sunburst_PFC_connectivity/data/structureData.json";
	$.ajax(url, {
		crossDomain: true,
		success: processStructures,
		error: function(response) { apiError(response.statusText, url); }
	});
	
	//Input data
	apiQuery("https://github.com/PierreLeMerre/Plotly/Sunburst_PFC_connectivity/data/PFC_SST_input.json",processExpression);
	apiQuery("https://github.com/PierreLeMerre/Plotly/Sunburst_PFC_connectivity/data/PFC_SST_input.json",processNumber);
	apiQuery("https://github.com/PierreLeMerre/Plotly/Sunburst_PFC_connectivity/data/PFC_SST_input.json",processRatio);
	
	
	// These two methods simply exist to set the `structures`, `expression`, and 'number'
	// variables in `importData`'s scope.  They both call `processData` 
	// afterwards, which will only run one both variables have been set.

	function processStructures(data) {

		// On Chrome, the response is already a javascript object. 
		// On IE/Firefox, it comes back as a string.  
		if (typeof(data) == "string") 
			data = JSON.parse(data);						

		structures = findChild(data.msg[0], rootId);
		processData();
	}

	// This transforms the returned StructureUnionize rows into a hash from
	// structure id to expression energy value.

	function processExpression(data) {
		expression = {};
		for (var i = 0; i < data.length; i++) {
			var e = data[i];
			expression[e.structure_id] = d3.round(e.expression_energy*100,2);
		}
		processData();
	}
	
	function processNumber(data) {
		number = {};
		for (var i = 0; i < data.length; i++) {
			var e = data[i];
			// number[e.structure_id] = e.number;
			number[e.structure_id] = String(e.number) +" (" +String(d3.round(e.number/4,0)) +")";
		}
		processData();
	}

	function processRatio(data) {
		ratio= {};
		for (var i = 0; i < data.length; i++) {
			var e = data[i];
			ratio[e.structure_id] = d3.round(e.ratio,2);
		}
		processData();
	}

	// Check that all of the data is finished downloading and returns it if so.

	function processData() {
		if (!structures || !expression || !number || !ratio)
			return;

		callback(structures,expression,number,ratio);
	}

	// Find a structure's child structure, by structure id.
	
	function findChild(structure, childId) {
		if (structure.id == childId)
			return structure;
		else {
			for (var i=0; i<structure.children.length; i++) {
				var r = findChild(structure.children[i], childId);
				if (r) return r;
			}
			return null;
		}
	}

	// If something goes wrong, alert the user.

	function apiError(response, url) {

		var errorHtml = 
			"<p>There was an error with the following query:</p>" + 
			"<p>" + url + "</p>" + 
			"<p>Error message:</p>" + 
			"<p>" + response + "</p>";
		
		var dialog = $( "#errorDialog" );
		
		var existingErrors = dialog.html();
		
		$( "#errorDialog" )
			.html(existingErrors + errorHtml)
			.dialog({
				width: 500,
				height: 200,
				modal: true
			});
	}

	// Make an API query.  You can't actually request all result rows of a query
	// at one time.  This function takes care of appending all of the pages of
	// results together.

	function apiQuery(path, onsuccess) {
		var rows = [];
		var num_rows = 2000;
		var total_rows = -1;

		apiPageQuery();

		// Make the actual query.  Keep downloading more rows until they have 
		// all been retrieved.  All API queries return the total number of rows
		// in the request, so we have to make a request before we can find out
		// how many rows will be in it.

		function apiPageQuery() {
			var url = path

			$.ajax(url, {
				crossDomain: true,
				success: function(response) {
					// On Chrome, the response is already a javascript object. 
					// On IE/Firefox, it comes back as a string.  
					if (typeof(response) == "string") 
						response = JSON.parse(response);						

					if (response.success) {
						processExpression(response.msg)
					} else {
						apiError(response.msg, url);
					}
					if (response.success) {
						processNumber(response.msg)
					} else {
						apiError(response.msg, url);
					}
					if (response.success) {
						processRatio(response.msg)
					} else {
						apiError(response.msg, url);
					}
				},
				error: function(response) {
					apiError(response.statusText, url);
				}
			});
		}
	}
}