/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var fs = require('fs');
var Converter = require('csvtojson').core.Converter;
var path = require('path');

var data = {
  ECIDsToParties: {},
  ConstituencyToID: {},
  constituencies: {}
}

var constituenciesCsv = fs.createReadStream('./ge2015-election-data/constituencies/constituencies.csv');
var constituenciesConverter = new Converter({ constructResult: false });

var candidatesCsv = fs.createReadStream('./ge2015-election-data/candidates.csv');
var candidatesConverter = new Converter({ constructResult: false });

var votesDir = './ge2015-election-data/votes/';

constituenciesConverter.on('record_parsed', function(d){
  var id = d['Constituency Code'];
  var name = d['Constituency'];
  if(id == 'W07000041') name = 'Ynys Môn';
  if(!data.ConstituencyToID[name]) data.ConstituencyToID[name] = id;
  data.constituencies[id] = {
    name: name,
    candidates: {}
  }
});

constituenciesConverter.on('end_parsed', function(){
  candidatesCsv.pipe(candidatesConverter);
});

candidatesConverter.on('record_parsed', function(d){
  var pid = d.party_id;
  if(pid == '') pid = generateJointIDs(d.party);
  if(!data.ECIDsToParties[pid]) data.ECIDsToParties[pid] = d.party;
  var o = {
    name: d.name,
    gender: d.gender,
    birth: d.birth_date,
    email: d.email,
    twitter: d.twitter_username,
    facebook: d.facebook_personal_url,
    facebook_page: d.facebook_page_url,
    linkedin: d.linkedin_url,
    party_info: d.party_ppc_page_url,
    site: d.homepage_url,
    wikipedia: d.wikipedia_url,
    theyworkforyou: d.theyworkforyou_url
  }
  data.constituencies[d.gss_code].candidates[pid] = o;
});

candidatesConverter.on('end_parsed', function(){
  fs.readdir(votesDir, function(err, files){
    if(err) console.error(err);
    files.forEach(function(file, index){
      if(file == 'example-votes.csv' || file == 'schema.json') return;
      file = path.resolve(votesDir, file);
      var votesCsv = fs.createReadStream(file);
      
      var votesConverter = new Converter({ constructResult: false });
      
      votesConverter.on('record_parsed', function(d){
        var cid = d['Constituency Code'];
        var party = d['Party'];
        var pid = d['Party ID'];
        var votes = d['Votes'];
        if(pid == '') pid = generateJointIDs(party);
        data.constituencies[cid].candidates[pid].votes = votes;
      });

      votesConverter.on('end_parsed', function(){
        if(files.length == index + 1) cleanup();
      });
      votesCsv.pipe(votesConverter);
    });
  });
});

function cleanup(){
  console.log(JSON.stringify(data, null, 2));
}

function generateJointIDs(party){
  if(party == 'Independent') return 'INDPT';
  else if(party == 'Speaker seeking re-election') return 'SPKR';
  else if(party == 'Labour and Co-operative Party') return 'PP53&PP119';
  else if(party == 'Left Unity - Trade Unionists and Socialists') return 'PP2045&PP804';
  else console.log(party);
}

constituenciesCsv.pipe(constituenciesConverter);
