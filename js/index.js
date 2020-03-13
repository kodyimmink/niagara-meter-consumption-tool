//METER CONSUMPTION TOOL

//This tool provides totalized comsumption values for a single or muitiple meter trends
//during a selected time period and breaks down consumption by a selected interval (15 Minutes, 1 Hour, 24 Hours).

//This tool utilizes the Niagara Analytics Web API
//In order to use it you must: 
//      * have a license for Niagara Analytics
//      * have the Web API (found in the Analytics palette) installed under AnalyticsService
//      * have Dictionary Tags setup on the station for each data point that you want the tool to utilize.
//      * have trends setup for the tagged data points

//MORE CONFIGURATION OPTIONS MAY NEED TO BE CHANGED IN THE CODE; SEE THE createRequestObject() FUNCTION FOR MORE CONFIG OPTIONS

//CONSTANTS
//Set your Niagara supervisor url here
//must be in the form of 
//http://HOSTNAME/na

const API_URL = ''

//Set your timezone offset here
//18000000 is for EST timezone (in milliseconds)
const timezoneOffset = 18000000;

//Set your Niagara base slot path here
//must be in the form of 
//station:|slot:/SOME_SLOT_PATH
const baseSlot = '';

//Set your Niagara tag query here; you can use both neql and bql queries to search for tags in your station.
//Utilizing tag dictionary rules in your station can assist in mass tagging points that you want to use for your meter calculations
//example: 
//neql:msi:electricMeter or msi:steamMeter or msi:waterMeter or msi:wasteMeter or msi:stormMeter|bql:select parent.parent.displayName as 'location', parent.displayName as 'device', displayName as 'pointName', ord as 'ord'
const tagQuery = ""

//APPLICATION CODE

//Do not set these; program will
//Global Variables
let startDateTime = '';
let endDateTime = '';
let summarizeByInterval = 0;

//create and attach chart to dom
let lineChart = c3.generate({
    size: {
        height: 420
    },
    bindto: "#lineChart",
    data: {
        x: 'x',
        columns: []
    },
    axis: {
        x: {
            type: 'timeseries',
            tick: {
                format: '%m-%d-%Y %H:%M'
            }
        }
    }
});

//displays consumption data in c3 web chart
function displayConsumptionDataInChart(consumptionDataArray) {

    //array for c3 chart load
    let columnsObject = {
        x: 'x',
        columns: []
    }

    let dateTime = ['x']
    consumptionDataArray[0].consumptionWindows.forEach(consumptionWindow => {

        //format date time, use end time for time stamp
        let dateTimeFormatted = new Date(consumptionWindow[1]);
        dateTime.push(dateTimeFormatted);
    })

    //add date time for c3 chart object
    columnsObject.columns.push(dateTime);

    consumptionDataArray.forEach(meterDataObject => {

        //create array to hold data series name, and data series
        let dataArray = [];
        dataArray.push(meterDataObject.name)

        //add series data to data array
        meterDataObject.consumptionWindows.forEach(consumptionWindow => {
            dataArray.push(Math.floor(consumptionWindow[2]))
        })
        columnsObject.columns.push(dataArray);
    })

    //destroy old line chart
    lineChart.destroy();

    //create new line chart
    lineChart = c3.generate({
        size: {
            height: 420
        },
        bindto: "#lineChart",
        data: columnsObject,
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    format: '%m-%d-%Y %H:%M'
                }
            }
        }
    });

}

//displays consumption data in html table
function displayConsumptionDataInTable(consumptionDataArray) {

    let table = document.getElementById("consumptionTable");
    let tableForm = $('#consumptionTable');

    function addStartEndTime() {
        for (let i = 0; i < consumptionDataArray[0].consumptionWindows.length; i++) {
            let row = table.insertRow();
            for (let j = 0; j < 2; j++) {
                let cell = row.insertCell();
                let dateTime = moment(consumptionDataArray[0].consumptionWindows[i][j]).format("dddd MMMM Do YYYY h:mm:ss a");
                let text = document.createTextNode(dateTime);
                cell.appendChild(text);
            }
        }
    }

    function addConsumptionData(consumptionWindows, meterName) {
        tableForm.find('tr').each(function () {
            var tableRow = $(this);
            if (tableRow.index() === 0) {
                tableRow.append('<th>' + meterName + '</th>');
            } else {
                tableRow.append('<td>' + Math.floor(consumptionWindows[tableRow.index() - 1][2]) + '</td>');
            }
        });
    }

    function addData() {
        consumptionDataArray.forEach(meterObject => {
            addConsumptionData(meterObject.consumptionWindows, meterObject.name)
        })
    }

    addStartEndTime();
    addData();

}

//calulates the total consumption in the consumption windows (time periods)
function calculateConsumptionDuringWindows(metersIntervalsArray) {

    let metersWithConsumptionArray = [];

    metersIntervalsArray.forEach((meterObject) => {
        var nameStringArray = meterObject.node.split('/');
        let summarizeIntervalLength = meterObject.summarizeIntervals.length;
        let meterConsumptionObject = {};
        meterConsumptionObject.name = nameStringArray[nameStringArray.length - 3] + " - " + nameStringArray[nameStringArray.length - 2]+ " - " + nameStringArray[nameStringArray.length - 1];
        meterConsumptionObject.consumptionWindows = [];

        for (var i = 0; i < meterObject.summarizeIntervals.length; i++) {
            let consumptionWindow = []

            if (i != summarizeIntervalLength - 1) {

                //beginning of consumption window 
                consumptionWindow.push(meterObject.summarizeIntervals[i][0]);

                //end of consumption window
                consumptionWindow.push(meterObject.summarizeIntervals[i + 1][0]);

                //beginning window value
                var startValue = parseFloat((meterObject.summarizeIntervals[i][1]));

                //beginning window value
                var endValue = parseFloat((meterObject.summarizeIntervals[i + 1][1]));

                //calculate consumption in window
                var totalConsumptionInWindow = endValue - startValue;
                consumptionWindow.push(totalConsumptionInWindow);

                meterConsumptionObject.consumptionWindows.push(consumptionWindow);
            }
        }
        metersWithConsumptionArray.push(meterConsumptionObject);
    })

    //display data in table
    displayConsumptionDataInTable(metersWithConsumptionArray);

    //display data in chart
    displayConsumptionDataInChart(metersWithConsumptionArray);
}

//determine the consumption windows (time periods) for the selected date/time range
function determineConsumptionWindows(responseObject) {

    let metersWithIntervalsArray = [];

    var currentTimeStampEpoch = 0;
    var previousTimeStampEpoch = 0;
    var currentValue = 0;
    var previousValue = 0;
    var monthRolloverValue = 0;

    responseObject.responses.forEach((meterTrend) => {
        let objectLength = meterTrend.rows.length;
        let meterSummarizeIntervalTrendObject = {};

        //parse name for Substation and Meter Name here
        meterSummarizeIntervalTrendObject.node = meterTrend.node;
        meterSummarizeIntervalTrendObject.name = meterTrend.seriesName;
        meterSummarizeIntervalTrendObject.summarizeIntervals = [];
        meterTrend.rows.forEach((trendPoint, index) => {

            trendPoint[1] = parseFloat(trendPoint[1]);


            previousTimeStampEpoch = currentTimeStampEpoch;
            currentTimeStampEpoch = (new Date(trendPoint[0]).getTime() - timezoneOffset) % summarizeByInterval;

            previousValue = currentValue;
            currentValue = trendPoint[1];



            if (currentValue + 1 < previousValue) {
                console.log("Current Value: " + currentValue);
                console.log("Previous Value: " + previousValue);
                monthRolloverValue = monthRolloverValue + previousValue;
                console.log("Rollover value " + monthRolloverValue);
                console.log("Trend Point " + trendPoint);
            }

            if (index === 0 || index === objectLength - 1) {

                trendPoint[1] = trendPoint[1] + monthRolloverValue;
                meterSummarizeIntervalTrendObject.summarizeIntervals.push(trendPoint);

            } else {
                if (currentTimeStampEpoch <= previousTimeStampEpoch) {
                    trendPoint[1] = trendPoint[1] + monthRolloverValue;
                    meterSummarizeIntervalTrendObject.summarizeIntervals.push(trendPoint);


                }
            }
        });
        metersWithIntervalsArray.push(meterSummarizeIntervalTrendObject);
    });

    //calculate the consumption during each interval window
    calculateConsumptionDuringWindows(metersWithIntervalsArray);
}

//standard POST implementation
async function postData(url = '', request = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'include', // include, *same-origin, omit
        headers: {
            'Content-Type': 'text/plain'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *client
        body: JSON.stringify(request) // body data type must match "Content-Type" header
    });
    return await response.json(); // parses JSON response into native JavaScript objects
}


//create Niagara Web API request object
function createRequestObject() {

    if (startDateTime === '' || endDateTime === '') {

        // error handling
        // var errorMessage = document.createElement('p')
        // errorMessage.setAttribute("class", "alert alert-primary");
        // errorMessage.setAttribute("role", "alert");
        // errorMessage.setAttribute("id", "errorMessagePara");
        // console.log(errorMessage);
        // document.getElementById("errorMessage").innerHTML("Please select a data and time.");
        // document.getElementById("errorMessage").appendChild(errorMessage);

    } else {
        
        //clear existing table
        $("#consumptionTable tr").remove();
        $("#consumptionTable thead").append(
            "<tr>" +
            "<th>Start Time</th>" +
            "<th>End Time</th>" +
            "</tr>"
        );

        let metersList = $('#metersListSelect').val();
        let dateTimeRange = startDateTime + ";" + endDateTime;

        //set to use when data gets back
        summarizeByInterval = ($('#summarizeIntervalSelect').val() * 60 * 1000);

        //create request object
        var requestObject = {
            "requests": []
        };

        //generate request object for each meter selected
        //DEPENDING ON YOUR TAG NAMES AND HOW YOU WANT THE DATA TO BE 
        //RETURNED IT MAY BE NECESSARY TO CHANGE SOME OF THESE OPTIONS!!!
        metersList.forEach(meter => {
            requestObject.requests.push({
                "message": "GetTrend",
                "node": meter,
                "data": "msi:meter",
                "timerange": dateTimeRange,
                "interval": "fifteenMinutes",
                "rollup": "median"
            })
        })

        //get data from Niagara Station, then calculate consumption
        postData(API_URL, requestObject).then(response => determineConsumptionWindows(response));
    }
}


//get nodes from Niagara station
function generateNodes() {

    //build query to return meters
    nodeQuery = {
        "requests": [{
            "message": "Query",
            "node": baseSlot,
            "query": tagQuery
        }]
    }

    var meterOptionsArray = [];
    //get nodes list from Niagara Station
    postData(API_URL, nodeQuery).then(data => {
        var metersList = data.responses[0].rows
        for (i = 0; i < metersList.length; i++) {
            var option = {};
            option.text = metersList[i][0] + " - " + metersList[i][1]+ " - " + metersList[i][2];
            option.value = metersList[i][3];
            meterOptionsArray.push(option);
        }

        let optionList = document.getElementById('metersListSelect').options;
        meterOptionsArray.forEach(option =>
            optionList.add(
                new Option(option.text, option.value)
            )
        );
    })
}


//export data to csv
function downloadCSV(csv, filename) {
    var csvFile;
    var downloadLink;

    // CSV file
    csvFile = new Blob([csv], {
        type: "text/csv"
    });

    // Download link
    downloadLink = document.createElement("a");

    // File name
    downloadLink.download = filename;

    // Create a link to the file
    downloadLink.href = window.URL.createObjectURL(csvFile);

    // Hide download link
    downloadLink.style.display = "none";

    // Add the link to DOM
    document.body.appendChild(downloadLink);

    // Click download link
    downloadLink.click();
}

//export table to csv format
function exportTableToCSV(filename) {
    var csv = [];
    var rows = document.getElementById("consumptionTable").querySelectorAll("tr");

    for (var i = 0; i < rows.length; i++) {
        var row = [],
            cols = rows[i].querySelectorAll("td, th");

        for (var j = 0; j < cols.length; j++)
            row.push(cols[j].innerText);

        csv.push(row.join(","));
    }

    // Download CSV file
    downloadCSV(csv.join("\n"), filename);
}