(function() {

var kn_data = {
	gs_data: {},
	gs_tabs: 1,
	gs_url: 'https://docs.google.com/spreadsheets/d/1nArn_GEHuKORqLhfJTA_9jiGXLIu6cZwI3gr64XXoJk/',
	templates: {
		video_list: 'hbs/video_list.hbs',
	},
}

var f = {};

f.parseGSData = function(d) {

	f.getGSKeys = function(d) {
		// get keys of first index
		var keys = Object.keys(d[0]);
		var keep_keys = []
		// loop and delete keys that don't start with "gsx"
		for (var i=0; i<keys.length; i++) {
			if (keys[i].search("gsx") != -1) {
				keep_keys.push(keys[i].replace("gsx$", ""));
			}
		}
		return keep_keys;
	}

	f.buildNewArray = function(d) {
		var keys = f.getGSKeys(d);
		var data = []
		for (var i=0; i<d.length; i++) {
			data.push({});
			for (var k=0; k<keys.length; k++) {
				data[data.length-1][keys[k]] = d[i]["gsx$"+keys[k]]["$t"];
			}
		}
		return data;
	}

	var data = f.buildNewArray(d);
	return data;
}

// THIS FUNCTION GETS THE DATA INSIDE THE CORRECT TAB (identified by worksheet_id)
// INSIDE THE GOOGLE SHEET
f.getGSData = function(key, worksheet_id) {
	// GET CACHE FILE NAME FROM KEY AND WORKSHEEET ID
	var cache_file_name = 'google_sheet_'+key+'_worksheet_'+worksheet_id+'_data';
	cache_file_name = cache_file_name.toLowerCase();
	$.ajax({
		url: 'http://host.coxmediagroup.com/cop/digital/common/cache/cacher.php?saveas='+cache_file_name+'&json_url='+encodeURIComponent('https://spreadsheets.google.com/feeds/list/'+key+'/'+worksheet_id+'/public/values?alt=json'),
		dataType: 'json',
		success: function(result) {
			kn_data.gs_data[result.feed.title.$t] = f.parseGSData(result.feed.entry);
		}
	});
}


f.getGSWorksheetIDs = function(gsurl) {
	// THE SHEET KEY IS THE 5th INDEX WHEN SPLITTING BY "/"
	var gsKey = gsurl.split("/")[5];
	// SET THE CACHE FILE NAME
	var cache_file_name = 'google_sheet_'+gsKey+'_meta';
	cache_file_name = cache_file_name.toLowerCase();
	// GET THE KEY TO GET THE DATA ABOUT THE SPEADSHEET
	$.ajax({
		url: 'http://host.coxmediagroup.com/cop/digital/common/cache/cacher.php?saveas='+cache_file_name+'&json_url='+encodeURIComponent('https://spreadsheets.google.com/feeds/worksheets/'+gsKey+'/public/full?alt=json'),
		dataType: 'json',
		success: function(result) {
			kn_data.number_of_tabs = result.feed.entry.length;
			// THIS LOOP GRABS THE WORKSHEET ID FOR EACH TAB
			// AND RUNS THE FUNCTION TO GET THE DATA IN THE TAB
			for (var i=0; i<result.feed.entry.length; i++) {
				// WORKSHEET ID IS 8th INDEX WHEN SPLITTING ID PROPERTY BY "/"
				var worksheet_id = result.feed.entry[i].id.$t.split("/")[8];
				// CALL THE FUNCTION TO GET THE DATA
				f.getGSData(gsKey, worksheet_id);
			}
		}
	})
}

f.output_search_input = function() {
	var gs_tabs_loaded = Object.keys(kn_data.gs_data).length;
	if (kn_data.gs_tabs == gs_tabs_loaded) {
		var search_bar = '<input type="text" class="form-control" id="search_input"/>'
		$("#search_input_container").html(search_bar);
	} else {
		setTimeout(function() {
			f.output_search_input();
		}, 200)
	}
}

f.outputHandlebarsTemplate = function(data,template,destination) {
	if ($(destination).length > 0) {
		$.get(template)
		//$.get('http://host.coxmediagroup.com/cop/digital/common/php/simple_get_file.php?url='+encodeURIComponent(template))
		.then(function(template) {
			//===== start helpers ======
			//send back parsed html
			Handlebars.registerHelper('parse_html', function(html) {
				return new Handlebars.SafeString(html);
			});
			//check if this is video section
			Handlebars.registerHelper('if_title_section', function(section,options) {
				if (section == 'Title') {
					return options.fn(this);
				} else {
					return options.inverse(this);
				}
			})
			//=====end helpers======
			template = Handlebars.compile(template);
			$(destination).html(template(data));
		})
	} else {
		setTimeout(function() {
			outputHandlebarsTemplate(data,template,destination);
		}, 200);
	}
}

f.search_videos = function(string) {
	//if at least 2 characters have been typed
	if (string.length>2) {
		//convert string to lowercase
		string = string.toLowerCase();
		//we'll split up the matching videos
		//by whether the string is in the title or keywords
		var by_title = [];
		var by_keyword = [];
		//loop through the videos in the videos tab of the google sheet
		for (i in kn_data.gs_data.videos) {
			var v = JSON.parse(JSON.stringify(kn_data.gs_data.videos[i]));
			//convert title to all lowercase
			v.title = v.title.toLowerCase();
			//check the title
			if (v.title.indexOf(string) != -1) {
				by_title.push(v);
				by_title[by_title.length-1].display_title = by_title[by_title.length-1].title.replace(string, '<span class="string_match">'+string+'</span>');
			}
			//check the keywords
			var keywords = v.keywords.split(";");
			var matching_keywords = [];
			for (k in keywords) {
				//cut out any leading spaces
				keywords[k] = keywords[k].trim();
				//make the keyword lowercase
				keywords[k] = keywords[k].toLowerCase();
				if (keywords[k].indexOf(string) != -1) {
					//add this to keywords array if not already there
					if (by_keyword.indexOf(v) == -1) {
						by_keyword.push(v);
						by_keyword[by_keyword.length-1].matching_keywords = [];
					}
					keywords[k] = keywords[k].replace(string,'<span class="string_match">'+string+'</span>')
					by_keyword[by_keyword.length-1].matching_keywords.push(keywords[k]);
				}
			}
		}
		console.log(by_title);
		console.log(by_keyword);
		//======output the sections
		//by title
		var title_data = {};
		title_data.type = 'Title';
		title_data.results = by_title;
		//by keyword
		var keyword_data = {};
		keyword_data.type = 'Keyword';
		keyword_data.results = by_keyword;
		//send out the templates
		f.outputHandlebarsTemplate(title_data,kn_data.templates.video_list,"#title_match");
		f.outputHandlebarsTemplate(keyword_data,kn_data.templates.video_list,"#keyword_match");
	}
}

f.resizeElements = function() {
	// GET WIDTHS
	var container_width = $("#kn_container").outerWidth();
	var window_width = window.outerWidth;
}

f.addEventListeners = function() {

	// RESIZE ELEMENTS ON WINDOW RESIZE
	window.onresize = function() {
		f.resizeElements();
	}

	// RESIZE ELEMENTS ON THE ORIENTATION CHANGE
	$(window).on("orientationchange",function() {
		// CALL RESIZE FUNCTION
		for (i=1000;i<=6000;i+=1000) {
			setTimeout(function() {
				f.resizeElements();
			}, i);
		}
	});

	$(document).on("keyup","#search_input", function() {
		var string = $(this).val();
		f.search_videos(string);
	})

}

f.load_page = function() {
	f.getGSWorksheetIDs(kn_data.gs_url);
	f.output_search_input();
	f.addEventListeners();
}

f.load_page();

})();