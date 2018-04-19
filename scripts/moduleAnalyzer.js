/** This script will analyze the University of Worcesters Module Directory, found at:
		https://ext-webapp-01.worc.ac.uk/cgi-bin/module/module_directory_17tt.pl
		If the path changes significantly then the script might not work.
*/

//// Global variables
// Get the full url of the page for ajax posts later
var URL = `${document.location.protocol}//${document.location.hostname}${document.location.pathname}`;
/* Used to keep track of how many unresolved Ajax requests we have.
	 Should allow us to run a thing after all modules are retrieved */
var GlobalStats = {
	moduleCount: 0,
	susModules: 0,
	waitingFor: 0,
	susModulesList: [],
	otherModuleList: []
};

// var saveFile = "Module Title, Module Description, Keyword Count,"
var keywordList = ["\\bAccess to Justice","Accountable Institutions","Affordable Energy","All ages--elderly","Biodiviersity","Cities","Climate Change","Conserve Oceans","Consumption","Decent Work","Desertification","Economic Growth","Ecosystems","Employment","Empower women","Energy","Equitable Education","Food Security","Foster Innovation","Gender Equality","Girls","Global Partnership for Sustainable Development","Healthy Lives","Human Settlements","Hunger","Inclusive Cities","Inclusive Education","Inclusive Human Settlements","Inclusive Institutions","Inclusive Societies","Industrialization","Inequality","Infrastructure","Innovation","Justice","Land Degradation","Land","Manage Forests","Marine","Nutrition","Oceans","Opportunities for all","Peaceful Societies","Poverty","Productive Employment","Productive Patterns","Reduce Inequality","Reliable Energy","Resilient Infrastructure","Sanitation","Seas","Sustainability","Sustainable Agriculture","Sustainable Consumption","Sustainable Economic Growth","Sustainable Energy","Sustainable Growth","Sustainable Industrialization","Sustainable Oceans","Sustainable","Terrestrial Ecosystems","Water","Well-Being","Women\\b"]
var keywordRegex = new RegExp(keywordList.join('\\b|\\b'), 'giu');

var loadingAnim;

/***** Code *****/

// Ask to run
if(window.confirm(`
I have detected that this is the module page for the University of Worcester.
Would you like me to analyze that for you?
`)) {
	runModuleAnalyzer()
}

// Actual stuff to run
function runModuleAnalyzer() {
	console.log("Analyzing Modules");

	// Some fun loading animation stuff
	// var lod = ['|','/','--','\\','|','/','--','\\'];
	var lod = ['','.','. .','. . .'];
	var lodN = 0;
	jQuery("#results_table").html(`<p id='loading_text'>Finding sustainability related modules ${lod[lodN]}</p>
<div id='stats'>
<p>Total modules analyzed: ${GlobalStats.moduleCount}</p>
<p>Sustainability related modules: ${GlobalStats.susModules}</p>
<p>Percentage: ${GlobalStats.susModules/GlobalStats.moduleCount*100}%</p>
<p>Waiting on ${GlobalStats.waitingFor} modules</p>
</div>
`);
	loadingAnim = window.setInterval(function() {
		lodN+=1;
		jQuery("#loading_text").text(`Finding sustainability related modules ${lod[lodN%lod.length]}`);
	}, 300);

	// Get the department and level options from the form
	departments = document.getElementById('dept_select').options;
	levels = document.getElementById('level_select').options;

	// For each through both the departments and levels
	// Option 1 is "-Select-", so we need to skip it
	for(i = 1; i < departments.length; i++) { // Make sure you are getting all depts/levels
		for(j = 1; j < levels.length - 1; j++) {
			// We have decided to ignore graduate modules, so end at '-1'

			// Send an Ajax request for the list of modules in a given department for a given level
			// Params for the request
			postData = {
				choices: 'yes',
				dept: departments[i].value,
				level: levels[j].value,
				psl_code: '',
				credits: '0',
				pre_req_check: 'N'
			};

			// Send the request (as a post)
			console.log("Sending Ajax for: "+departments[i].value +" "+levels[j].value)
			$.ajax({
				type: "POST",
				url: URL, // The ajax does not work if you dont give it a full url, not sure why
				data: postData,
				dataTypes: "html",
				complete: function(data, status){
					console.log(`Retrieved a module list`);
					readModuleList(data.responseText);
				},
				error: function(xhr, status, error) {
					console.error(error);
				}
			});
		}
	}
}

/* Helper to read the list of modules (response to initial requests) */
function readModuleList(responseText) {
	// The result is an html block, so we need to parse it into something useful
	var parser = new DOMParser();
	var ResDoc = parser.parseFromString(responseText, "text/html");
	var links = ResDoc.getElementsByClassName("dialog");

	/* There are two links for every class, the one with the name and the calendar one
		 The innerText for the first link is the module title, the innerText for the second is empty
		 If they change the layout of the response this might break */
	var modules = Array.from(links).map(el => el.innerText).filter(el => el != "");

	// We now have a list of modules names, so we need to request the information about each one
	modules.forEach(getModuleInfo);
}

/* Helper to get a modules info based on its name (sends request) */
function getModuleInfo(moduleName) {
	// Similar ajax to before, but the query is different
	postData = {
		mod_code: moduleName,
		module: "yes"
	};
	// Keep track of unresolved requests
	GlobalStats.waitingFor += 1;
	// Send the request
	$.ajax({
		type: "POST",
		url: window.thisURL,
		data: postData,
		dataTypes: "html",
		complete: function(data, status){
			if(status == "success") {
				readModuleInfo(data.responseText);
			}
			else {
				console.error(`Could not get information for module !{moduleName}`);
			}
		},
		error: function(xhr, status, error) {
			console.log(error);
		}
	});
}

/* Helper to read the results of a module request */
function readModuleInfo(responseText) {
	var parser = new DOMParser();
	var ResDoc = parser.parseFromString(responseText, "text/html");

	/* Get the module name and description.
		 They are in the only h3 and p elements, so thats how I get it.
		 If they change the layout of the response this might break */
	fullName = ResDoc.getElementsByTagName("h3")[0].innerText;
	mDescription = ResDoc.getElementsByTagName("p")[0].innerText;
	var [mCode, mName] = fullName.split(" - ", 2);

	// Keep track of how many modules we have analyzed
	GlobalStats.moduleCount += 1;

	// Check for keywords
	if(keywordRegex.test(mDescription) | keywordRegex.test(mName)) {
		// Keep track of the analyzed modules that match
		GlobalStats.susModules += 1;
		GlobalStats.susModulesList.push([mCode, mName, mDescription]);
		// Highlight words in description and name
		hDes = mDescription.replace(keywordRegex, `<span class="highlight">$&</span>`);
		hName = mName.replace(keywordRegex, `<span class="highlight">$&</span>`);
		jQuery("#results_table").append(`<tr><td>${mCode}</td><td>${hName}</td><td>${hDes}</td></tr>`);
	}
	else {
		GlobalStats.otherModuleList.push([mCode, mName, mDescription]);
	}

	// Check to see if this is the last response
	GlobalStats.waitingFor -= 1;
	if(GlobalStats.waitingFor == 0) {
		// Stop the animation
		window.clearInterval(loadingAnim);
		$("#loading_text").text("Finished Analyzing");
		// If there are no more unresolved Ajax requests, then we can print the final results
		console.log("Module count = " + GlobalStats.moduleCount);
		console.log("Sustainability modules = " + GlobalStats.susModules);
		/*
		// Print lists of sus modules and non-sus modules. Used in validation
		// (could not find a better way to export the information)
		susdata = GlobalStats.susModulesList.map(
			el => el.join('#').replace(/[\n\r\t]/gm,' '))
			.join("\n");
		console.log("Sus Modules")
		console.log(susdata);
		otherdata = GlobalStats.otherModuleList.map(
			el => el.join('#').replace(/[\n\r\t]/gm,' '))
			.join("\n")
		console.log("Other Modules");
		console.log(otherdata)
		//*/
	}
	// Write the stats to the page. Allows it to be clear that it is working
	jQuery("#stats").html(`
<p>Total modules analyzed: ${GlobalStats.moduleCount}</p>
<p>Sustainability related modules: ${GlobalStats.susModules}</p>
<p>Percentage: ${Math.round(GlobalStats.susModules/GlobalStats.moduleCount*100*100)/100}</p>
<p>Waiting on ${GlobalStats.waitingFor} modules</p>
`);
}
