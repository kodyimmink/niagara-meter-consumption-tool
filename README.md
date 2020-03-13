# Niagara Meter Consumption Tool

##### This tool provides totalized comsumption values for a single or muitiple meter trends during a selected time period and breaks down consumption by a selected interval (15 Minutes, 1 Hour, 24 Hours).

#####This tool utilizes the Niagara Analytics Web API to pull data from a Niagara Station and uses modern HTML and Javascript to display the data to the user.
#####In order to use it you must:
* have a feature license for Niagara Analytics
* have the Web API (found in the Analytics palette) installed under AnalyticsService
* have Dictionary Tags setup on the station for each data point that you want the tool to utilize.
* have historical trends setup on the tagged data points (imported from a JACE or on the Supervisor)

#### MORE CONFIGURATION OPTIONS MAY NEED TO BE CHANGED IN THE CODE; SEE THE createRequestObject() FUNCTION FOR MORE CONFIG OPTIONS