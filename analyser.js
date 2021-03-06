var previousPoint = null;
var state = {};
var plots = {};
var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function colourTableRows(table) {
 $('tr', table).removeClass('alt');
 $('tr:visible:even', table).addClass('alt');
}

function showTooltip(x, y, contents) {
 $('<div id="tooltip">' + contents + '</div>').css( {
  position: 'absolute',
  display: 'none',
  top: y + 5,
  left: x + 5,
  border: '1px solid #fdd',
  padding: '2px',
  'background-color': '#fee',
 }).appendTo("body").fadeIn(200);
}

function getDateKey(date) {
 return date.getFullYear() + '-' + (date.getMonth() < 9 ? '0' : '') + (date.getMonth() + 1);
}

function expandLinkHandler(event) {
 var text = $(this).text();
 var expanded = text.substr(0, 2) == '(+';

 if (!state.expanded) {
  state.expanded = {};
 }

 if (expanded) {
  state.expanded[event.data.id] = true;
  setState({}, []);
 } else {
  delete state.expanded[event.data.id];
  setState({}, []);
 }

 colourTableRows($('#historytable'));
 return false;
}

function setState(newState, invalidatedState) {
 $.extend(true, state, newState);

 $.each(invalidatedState, function(_, x) { delete state[x]; });

 $.history.load(JSON.stringify(state));
}

function showSelectedMonths(start, end, incoming, outgoing, categoryFilter) {
 $('#historytable tr.data').remove();
 $('#historytable').show();

 var startDate = new Date(start), endDate = new Date(end);

 if (startDate.getDate() > 1) {
  startDate.setDate(1);
  startDate.getMonth() == 11 && startDate.setYear(startDate.getFullYear() + 1);
  startDate.setMonth(startDate.getMonth() == 11 ? 0 : startDate.getMonth() + 1);
 }

 var startKey = getDateKey(startDate), endKey = getDateKey(endDate);

 if (startKey == endKey) {
  $('#historytable h3').text('Transactions for ' + months[startDate.getMonth()] + ' ' + startDate.getFullYear());
 } else if (startDate.getFullYear() == endDate.getFullYear()) {
  $('#historytable h3').text('Transactions for ' + months[startDate.getMonth()] + '-' + months[endDate.getMonth()] + ' ' + startDate.getFullYear());
 } else {
  $('#historytable h3').text('Transactions for ' + months[startDate.getMonth()] + ' ' + startDate.getFullYear() + ' - ' +  months[endDate.getMonth()] + ' ' + endDate.getFullYear());
 }

 var pieData = {};
 var table = $('#historytable table');
 var include = false;
 var lastEntry = {};
 var id = 0;
 $.each(data, function(month, monthData) {
  if (month == startKey) { include = true; }

  if (include) {
   $.each(monthData, function(index, trans) {
    if (incoming != trans.Amount > 0) { return; }

    var category = trans.Category ? trans.Category : 'Unsorted';
 
    if (category != '(Ignored)') {
     if (!pieData[category]) { pieData[category] = 0; }
     pieData[category] += Math.abs(trans.Amount);
    }

    if (categoryFilter && categoryFilter != category) { return; }

    var tr = $('<tr/>').addClass('data').addClass('category' + category.replace(/[^a-zA-Z]*/g, '')).appendTo(table);

    if (lastEntry.Description == trans.Description && lastEntry.Type == trans.Type && lastEntry.Category == lastEntry.Category) {
     tr.hide();

     if (lastEntry.id) {
      var prefix = '(' + (state.expanded && state.expanded[lastEntry.id] ? '-' : '+');
      lastEntry.count++;
      $('span', lastEntry.tr).text(prefix + lastEntry.count + ')');
     } else {
      lastEntry.id = ++id;
      lastEntry.count = 1;
      var prefix = '(' + (state.expanded && state.expanded[lastEntry.id] ? '-' : '+');
      var a = $('<span>').addClass('link').text(prefix + '1)').appendTo($('td.desc', lastEntry.tr).append(' '));
      a.bind('click', { id: lastEntry.id, tr: lastEntry.tr }, expandLinkHandler);
     }

     lastEntry.Amount = Math.round(100 * (lastEntry.Amount + trans.Amount)) / 100;
     if (state.expanded && state.expanded[lastEntry.id]) {
      tr.show();
     } else {
      $('.amount', lastEntry.tr).text(lastEntry.Amount);
     }

     tr.addClass('collapsed hidden' + lastEntry.id);

    } else {
     lastEntry = $.extend({}, trans, {tr: tr});
    }

    $('<td/>').text(trans.Date.date.split(' ')[0]).appendTo(tr);
    $('<td/>').text(trans.Type ? trans.Type : 'Other').appendTo(tr);
    $('<td/>').text(trans.Category ? trans.Category : '').appendTo(tr);
    $('<td/>').addClass('desc').text(trans.Description).appendTo(tr);
    $('<td/>').addClass('amount').text(trans.Amount).appendTo(tr);
   });
  }

  if (month == endKey) { include = false; }
 });
 colourTableRows(table);

 var seriesData = [];
 $.each(pieData, function(category, amount) {
  seriesData.push({ label: category + ' (' + Math.round(amount) + ')', data: amount });
 });

 seriesData.sort(function(a, b) { return b.data - a.data; });

 plots.expense = $.plot($('#expense'), seriesData, {
   series: { pie: { show: true, innerRadius: 0.5, highlight: { opacity: 0.5 } } },
   grid: { clickable: true }
 });
}

$(function() {
 var transData = [{label: 'Income', data: []}, {label: 'Expense', data: []}, {label: 'Difference', data: []}];
 var categories = {};
 var min = new Date().getTime(), max = 0;

 $.each(data, function(month, entries) {
  var split = month.split('-');
  var timestamp = new Date(split[0], split[1] - 1).getTime();
  var sum = [0, 0];

  $.each(entries, function() {
   if (this.Category == '(Ignored)') { return; }

   if (this.Amount < 0) {
    var category = this.Category ? this.Category : 'Unsorted';
    if (!categories[category]) { categories[category] = {}; }
    if (!categories[category][timestamp]) { categories[category][timestamp] = 0; }
    categories[category][timestamp] -= this.Amount;
   }

   sum[this.Amount < 0 ? 1 : 0] += this.Amount;
  });

  transData[0].data.push([timestamp, sum[0]]);
  transData[1].data.push([timestamp, sum[1]]);
  transData[2].data.push([timestamp, sum[0] + sum[1]]);
  min = Math.min(min, timestamp);
  max = Math.max(max, timestamp);
 }); 

 var catData = [];
 $.each(categories, function(category, entries) {
  var series = {label: category, data: []};
  var total = 0;

  $.each(transData[0].data, function() {
   var timestamp = this[0];
   var val = entries[timestamp] ? entries[timestamp] : 0;
   total += val;
   series.data.push([timestamp, val]);
  });

  series.total = total;

  catData.push(series);
 });

 var markings = [];

 var year = new Date(new Date(max).getFullYear(), 0);
 while (year.getTime() > min) {
  markings.push({ color: '#000', lineWidth: 1, xaxis: { from: year.getTime(), to: year.getTime() } });
  year.setFullYear(year.getFullYear() - 1);
 }

 catData.sort(function(a, b) { return a.total - b.total; });

 plots.cathistory = $.plot($('#cathistory'), catData, {
   xaxis: { mode: 'time', timeformat: '%y/%m' },
   legend: { noColumns: 2 },
   series: {
     stack: true,
     lines: { show: true, fill: true }
   },
   grid: {
    markings: markings
   }
 });

 markings.push({ color: '#000', lineWidth: 1, yaxis: { from: 0, to: 0 } });

 plots.history = $.plot($('#history'), transData, {
   xaxis: { mode: 'time', timeformat: '%y/%m' },
   series: {
     lines: { show: true, fill: true },
     points: { show: true }
   },
   legend: { noColumns: 3, position: 'nw' },
   grid: {
     hoverable: true,
     clickable: true,
     markings: markings 
   },
   selection: { mode : "x" }
 });

 $("#history").bind("plothover", function (event, pos, item) {
  if (item) {
   var id = {dataIndex: item.dataIndex, seriesIndex: item.seriesIndex};

   if (previousPoint == null || previousPoint.dataIndex != id.dataIndex || previousPoint.seriesIndex != id.seriesIndex) {
    previousPoint = id;
             
    $("#tooltip").remove();
    var x = item.datapoint[0],
        y = item.datapoint[1].toFixed(2);
                 
    var date = new Date(x);

    var seriesTitles = ["Money in", "Money out", "Balance change"];
    showTooltip(item.pageX, item.pageY, (seriesTitles[item.seriesIndex]) + " during " + months[date.getMonth()] + " " + date.getFullYear() + " = " + y);
   }
  } else {
   $("#tooltip").remove();
   previousPoint = null;            
  }
 });

 $('#history').bind('plotselected', function(event, ranges) {
  var startDate = parseInt(ranges.xaxis.from.toFixed());
  var endDate = parseInt(ranges.xaxis.to.toFixed());
 
  if (state.start != startDate || state.end != endDate || state.type != 'expenses') {
   setState({ start: startDate, end: endDate, type: 'expenses' }, ['categoryFilter', 'expanded']);
  }
 });

 $('#history').bind('plotclick', function(event, pos, item) {
  if (item) {
   setState({ start: item.datapoint[0], end: item.datapoint[0], type: item.seriesIndex == 0 ? 'income' : 'expenses' }, ['categoryFilter', 'expanded']);
  }
 });

 $('#expense').bind('plotclick', function(event, pos, item) {
  setState({ categoryFilter: item.series.label.replace(/ \([0-9]+\)$/, '') }, ['expanded']);
 });

 $.history.init(function(hash) {
  var oldState = $.extend({}, state);

  try {
   state = JSON.parse(hash);
  } catch (ex) {
   state = {};
  }

  var match = /start:([0-9]+);end:([0-9]+);type:(income|expenses)/.exec(hash);

  if (state.start && state.end && state.type) {
   showSelectedMonths(state.start, state.end, state.type == 'income', state.type == 'expenses', state.categoryFilter);
   (oldState.start != state.start || oldState.end != state.end) && plots.history.setSelection({ xaxis: { from: state.start, to: state.end }});
  }
 });
});
