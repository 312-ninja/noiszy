window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();


// track in GA when this page is created
// it's persistent, so it will only happne once

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-96120302-2', 'auto');
ga('set', 'checkProtocolTask', function(){}); // Removes failing protocol check. @see: http://stackoverflow.com/a/22152353/1958200
ga('set', 'forceSSL', true);
// suppress pageview.  We're only tracking options views & plugin clicks.
//ga('send', 'pageview');


function track_clicked_link(link) {
    console.log('tracking this link:\n',link);
    ga('send','pageview',link);
}


function isDevMode() {
    return !('update_url' in browser.runtime.getManifest());
}


function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function get_enabled_sites(callback) {
  browser.storage.local.get({
    sites: []
  }, function (result) {

    // build array of sites
    var sites = [];
    
    
    console.log("result",result);
//    var numcats = Object.keys(result.sites).length;
    var numcats = result.sites.length;
    console.log("numcats",numcats);
    var thissites;
    for (var c=0; c < numcats; c++) {
      
      thissites = result.sites[c].sites;
      
      try {
        for (var i=0; i < thissites.length; i++) {
//          console.log("thissites[i]",thissites[i]);
          if (thissites[i].checked) {
            if (thissites[i].url.indexOf("https://") == -1) {
              thissites[i].url = "http://"+thissites[i].url;
            }
            sites.push(thissites[i].url);
          }
        }
      } catch(e) {}
      console.log("enabled sites: ", sites);
    }
    
    console.log("enabled sites: ", sites);
    
    callback(sites);
  });
}

function open_new_site() {
  
  get_enabled_sites(function(result) {

    var sites = result;

    console.log("in open_new_site - sites",sites);

    
    var num = getRandomIntInclusive(0,sites.length-1);
    console.log(num);
    
    //prepend http if it doesn't already exist
    var new_url = sites[num];

    browser.storage.local.get('tabId', function (resultTabId) {

      browser.tabs.update(resultTabId.tabId, {url: new_url}, function() {
        // in case we want to put anything here...
      });
      browser.storage.local.set({activeSite: new_url}, function() {
        // in case we want to put anything here...
      });

      // GA tracking
      ga('send','pageview',new_url);

    });
  });
}


browser.alarms.onAlarm.addListener(function(alarm) {
  
  console.log("alarm.name", alarm.name);
  
  browser.storage.local.get('enabled', function(result){
    var enabled = result.enabled;
//    console.log("enabled", enabled);

    if (enabled == "Enabled" || enabled == "Running") {
    
      browser.storage.local.get({
        'tabId': [],
        'blockStreams': []
      }, function (result) {
        
        console.log(result.tabId);
        
        //get the tab, to be sure it exists
        browser.tabs.get(result.tabId, function (tab) {
          console.log("tab",tab);
          
          if (browser.runtime.lastError) {
            console.log(browser.runtime.lastError.message);
          } else {
      
            if (alarm.name == "newSite") {
              //open a new site;
              open_new_site();
              
            } else if (alarm.name == "linkClick") {
              //click a link on the page, using a content script
//              console.log("inside linkClick");
              browser.tabs.sendMessage(result.tabId, {
                text: 'click link',
                blockStreams: result.blockStreams
              }, function(response) {
//                console.log("in alarm tabs.sendMessage callback, response:",response);
                
                if (response == "linkclick failed") {
                  // just open a new site instead
                  open_new_site();
                  
                } else {
                  // track the link
                  console.log('tracking this link:',response);
                  ga('send','pageview',response);
                }
              });

              console.log("sent clicked_link");
            }

            // set the next alarm
            // randomize which type it should be
            // the '4' should be controlled in a setting, but use this for now

            // create alarm so link will be clicked
            browser.storage.local.get('baseInterval', function(result){
              // mult x random 2x, so results skew closer to baseInterval
              var interval = result.baseInterval + (Math.random() * Math.random() * result.baseInterval);
              
              var rand = getRandomIntInclusive(0,4);
//              console.log("rand alarm int: ", rand);
              if (rand == 0) { // 1/4 of the time
                browser.alarms.create("newSite",{delayInMinutes: interval});
              } else {
                browser.alarms.create("linkClick",{delayInMinutes: interval});
              }
            });

          }
        });
      });
    }
    console.log("alarm completed");
  });

});



browser.runtime.onMessage.addListener( function(request, sender, sendResponse) {
    
  console.log("message: ", request.msg);

  if (request.msg == "start") {
    // start visiting sites
    
    // first confirm that there are enabled sites
    get_enabled_sites(function(result) {

      if (result && result.length > 0) {

        //get current tab
        browser.tabs.query({active: true, currentWindow: true}, function(arrayOfTabs) {
          // since only one tab should be active and in the current window at once
          // the return variable should only have one entry
          var activeTab = arrayOfTabs[0];
          var activeTabId = activeTab.id; // or do whatever you need
//          console.log("arrayOfTabs[0]",arrayOfTabs[0]);
//          console.log("storing tab id: " + arrayOfTabs[0].id);
          // store the tab id
          browser.storage.local.set({tabId: arrayOfTabs[0].id}, function() {});

          // open new site
          open_new_site();
          sendResponse({farewell: "open_new_site called"});
        });

        // create first alarm - should always be a linkClick

        browser.storage.local.get('baseInterval', function(result){
          // mult x random 2x, so results skew lower
          var interval = result.baseInterval + (Math.random() * Math.random() * result.baseInterval);
          browser.alarms.create("linkClick",{delayInMinutes: interval});
        });
      } else { //no enabled sites
        // send a response; options page will show an alert
        console.log("no enabled sites");
        sendResponse({farewell: "no enabled sites"});
      }
    });

  } else if (request.msg == "track add site") {
    console.log("request", request);
    ga('send','event','add site',request.added);
    sendResponse("completed " + request.msg);
  } else if (request.msg == "track options open") {
    console.log("request", request);
    ga('send','pageview','options.html');
    sendResponse("completed " + request.msg);
  } else if (request.msg == "track link click") {
    ga('send','pageview',request.url);
    sendResponse("completed " + request.msg);
  } else if (request.msg == "reset") {
    initialize_noiszy(false, function(results){
      sendResponse(results);
    });
  }
  // we're done
  return true;
});


function initialize_noiszy(preserve_preferences, callbackFunction) {
  console.log("initializing");
  console.log("presets",presets);
  console.log("preserve_preferences",preserve_preferences);

  // in dev mode, load links more quickly
  var base_interval = isDevMode() ? 0.2 : 1;
  var block_streams = presets.blockStreams;
  var user_site_preset = presets.userSitePreset;
  
  // start with list of sites from presets (JSON)
//  var new_sites = JSON.parse(JSON.stringify(presets.sites));
  var new_sites = presets.sites;

      
  // load settings from local storage so we can work with them
  browser.storage.local.get({
    sites: [],
    blockStreams: [],
    userSitePreset: []
  }, function(result) {
    
//    if (result) {
    console.log("got from localStorage: ", result);

    // copy default from presets into local storage

    if (result && preserve_preferences && result.sites.length != 0) {
      console.log("preserving preferences");
      
      //if "default" exists, change "default" to "news"
      try {
        if (result.default) {
          //TODO: actually need to put it in categories.
          //find news category
          for (var i=0; i<new_sites.length; i++) {
            if (new_sites[i].name == "news") {
              //TODO: go item by item
              new_sites[i] = result.default; //TODO: not sure that's going to work, might want to test it...
            }
          }
//          new_sites.news ? delete new_sites.news: ''; // delete if it exists in result; will delete from lS at the end
//          new_sites = JSON.parse(JSON.stringify(new_sites).split('"default":').join('"news":')); // change name
          
          //TODO: then clear out result.default & also get it out of localStorage
          result.default = [];
        }
      } catch(e) {
        console.log("trouble updating preferences...");
        // so just delete them...?
        // TODO: delete prefs
      }
      

      // copy preferences on/off values into new_sites
      
      console.log("new_sites.length", new_sites.length);
      for (var i=0; i<new_sites.length; i++) {
//        console.log("checking for presets for new_sites[i].name", new_sites[i].name);
        // if category also exists in result.sites, copy result.sites over into new_sites
        for (var j=0; j<result.sites.length; j++) {
//          console.log("checking for presets for result.sites[j].name", result.sites[j].name);
          try {
            if (new_sites[i].name == result.sites[j].name) {
//              console.log("match!");
              //copy it over
              new_sites[i] = result.sites[j]; //TODO: check values to make sure they're all there - menuOpen, name, etc.
              j = result.sites.length; //end inner loop
            }
          } catch(e) {
            console.log("error copying prefs over presets", e);
          }
        }
      }
      
      //and block streams
      block_streams = result.blockStreams;
    }

    // now sites has current values
    // set values in local storage
    console.log("base_interval", base_interval);
    console.log("new_sites", new_sites);
    console.log("block_streams", block_streams);
        
    browser.storage.local.set({
      enabled: "Waiting",
      baseInterval: base_interval,
      blockStreams: block_streams,
      userSitePreset: user_site_preset,
      sites: new_sites
    }, function (result) {
      callbackFunction(result);
    });
    
//    }
    
  });
}

initialize_noiszy(true, function(){});