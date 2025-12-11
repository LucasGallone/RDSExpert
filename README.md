# Quick access to the different parts of the documentation

• [1 - Introduction](https://github.com/LucasGallone/RDSExpert#rdsexpert--introduction)
<br>
• [2 - First steps](https://github.com/LucasGallone/RDSExpert#first-steps)
<br>
• [3 - Main information display](https://github.com/LucasGallone/RDSExpert#main-information-display)
<br>
• [4 - Information history and data export to text format](https://github.com/LucasGallone/RDSExpert#information-history-and-data-export-to-text-format)
<br>
• [5 - Alternative Frequencies (AF)](https://github.com/LucasGallone/RDSExpert#alternative-frequencies-af)
<br>
• [6 - Radiotext+](https://github.com/LucasGallone/RDSExpert#radiotext)
<br>
• [7 - Enhanced Other Networks (EON)](https://github.com/LucasGallone/RDSExpert#enhanced-other-networks-eon)
<br>
• [8 - Groups Monitor](https://github.com/LucasGallone/RDSExpert#groups-monitor)
<br>
• [9 - Traffic Message Channel (TMC)](https://github.com/LucasGallone/RDSExpert#traffic-message-channel-tmc)
<br>
• [10 - System Logs](https://github.com/LucasGallone/RDSExpert#system-logs)

# RDSExpert | Introduction

RDSExpert is an advanced RDS (Radio Data System) decoder for TEF webservers, based over HTML.
<br>
It is also designed for RBDS (American variant).
<br>
<br>
-> [You can access the interface by clicking on this link.](https://lucasgallone.github.io/RDSExpert)
<br>
-> Otherwise, you can copy and paste the following URL: `https://lucasgallone.github.io/RDSExpert/`
<br>
<br>
This tool will be of particular interest to radio engineers and anyone with an interest in radio engineering. Its purpose is to allow in-depth analysis of the RDS data carried by FM signals, which webservers cannot completely display for obvious usability reasons.
<br>
<br>
Below, you will find a list of the elements that RDSExpert can decode and display, along with technical details.
<br>
<br>
<b>It is important to note that the RDS decoding is less sensitive than that used natively by TEF webservers.</b> Therefore, an "acceptable" signal is necessary for accurate decoding. While it would be technically possible to increase the decoding sensitivity, this would increase the risk of displaying erroneous data, making the tool less reliable. For DX receptions and very weak signals, it is therefore strongly recommended to use the integrated decoder of the TEF webservers.
<br>
<br>
<b>Another important detail is that this tool only works with HTTPS servers.</b> This is due to a security restriction implemented by web browsers that block connections to HTTP servers from an HTTPS interface (GitHub only offers HTTPS pages nowadays).
<br>
<br>
<b>Fortunately, it's possible to bypass this limitation by using the HTTP version hosted by [@Bkram](https://github.com/bkram/).</b> Follow the on-screen instructions when you indicate an HTTP URL, and you'll be able to use the tool that way.
<br>
<br>
RDSExpert is designed for desktop use. <b>The interface isn't optimized for smartphones yet, but this is planned for the near future!<b/>
<br>
<br>
Special thanks to [@mrwish7](https://github.com/mrwish7/) for the initial implementation of WebSocket decoding, without which creating this tool would have been much more complicated. Thanks also to everyone who offers suggestions, provides feedback on the decoder's functionality, and so on.

# First steps

To begin, indicate the HTTPS URL of the server (<b>and only HTTPS for the reason mentioned above</b>) you wish to connect to, then click `Connect`.
<br>
<br>
If everything goes well, the status should change to `CONNECTED`.
<br>
Tune in to a frequency with a reasonable signal, RDS information should then appear on the screen.
<br>
<br>
If the status shows `ERROR`, consult the `System Logs` section at the bottom of the page for more information about the problem.
<br>
<br>
💡 <b>Connecting to a server using the RDSExpert tool will not add an additional user to the server's counter.</b> The tool simply connects to the server's RDS websocket and does not allow any control over the tuning. This means that if you connect to the same server for tuning from a different tab/window while using RDSExpert in another, only one user will be counted.
<br>
<br>
An extra note: If you are using a server located in America, consider changing the mode from "RDS" to "RBDS".

# Main information display

| Function | Description |
| --- | --- |
| `TP` | `Traffic Program` <br> <br> When this flag is enabled, it generally means that the station may broadcast traffic information. <br> In reality, this flag is often enabled by default and primarily prevent car tuners to skip the station on automatic scan search. <br> <br> Therefore, it is frequently used by stations whose primary purpose is not to broadcast traffic information. Some receivers tend to ignore stations that do not transmit this flag. |
| `TA` | `Traffic Announcement` <br> <br> This flag is used when a radio station is currently broadcasting traffic information. <br> It should not be confused with `TP`. <br> <br> When this flag is enabled along with `TP`, car tuners configured for "Traffic Announcement" will automatically switch to that station. The `TA` flag has no specific effect when `TP` is not active. |
| `Music` | This flag indicates that the station is likely to broadcast music programs. <br> If this flag is not active, it means that the M/S flag is configurated in "Speech" mode. |
| `PI` | `Program Identification` <br> <br> Essential 4-character code for the receivers to identify the station and distinguish it from the others. <br> It is usually assigned by radio authorities to prevent multiple stations from using the same code, which would cause many problems for the listeners. |
| `PS` | `Program Service` <br> <br> Displays the station name, with a 8 characters limit. It can be dynamic (Multiple text sequences transmitted gradually). |
| `BER` | `Bit Error Rate` <br> <br> Calculates the error rate of the station's RDS decoding. <br> The closer this level is to 0%, the better the decoding is. <br> <br> The indicator is green when decoding is excellent or relatively good. <br> Orange when decoding becomes average or difficult. <br> Red when decoding becomes poor or very poor. |
| `RT A` <br> `RT B` | This function shows the two lines used by the `Radiotext` function, which is generally used to display the radio station's slogan, the title of the song which is currently aired, or other information about the station that may be useful to the listeners. <br> It is limited to 64 characters per line. <br> <br> In addition to displaying text, RDSExpert is able to show the "invisible" codes that allow the Radiotext decoding to be interrupted before it reaches 64 characters (Example: <0D>). |
| `PTY` | `Program Type` <br> <br> Indicates the type of program broadcast by the station (For example: Pop Music / Rock Music / Easy Listening / Oldies Music / News / …). <br> <br> The display of this information varies depending on whether you are using RDS or RBDS mode. This is why it is important to select RBDS mode if you are connecting to a server located in America. |
| `PTYN` | Has the same function as `PTY`, with the sole difference that it is fully customizable. <br> This means that an engineer can specify the text/value of his choice (limited to 8 characters) via group 10A. |
| `Long PS` | Has the same function as `PS`, but in a much extended range. This allows to display the name of a station which is longer than 8 characters (maximum 32 characters), via group 15A. <br> <br> This function is generally very rarely used. |
| `ECC` | `Extended Country Code` <br> <br> A two-character code identifying the country from which the station broadcasts (Example: E1 for France). <br> <br> This function is rarely used. |
| `LIC` | `Language Identification Code` <br> <br> A two-character code identifying the language in which the station broadcasts its programs (Example: 0F for French). <br> <br> This function is rarely used. |
| `Local CT (Clock Time)` | Displays the date and time according to the time zone of the country from which the station is broadcasting. <br> This function, transmitted via band 4A (generally every 60 seconds, at the beginning of each minute), automatically updates the clocks on listeners' car tuners. |
| `UTC CT (Clock Time)` | Serves the same purpose as Local CT, with the only difference being that the values ​​transmitted are in UTC (Coordinated Universal Time) format. |
| `PIN` | `Program Identification Number` <br> <br> This function provides an easy and automatic identification of a program currently being broadcast. <br> The decoder display shows the date and time the program began broadcasting, which some receivers can use for alarm clock functions or automatic recording scheduling. <br> <br> This function is very rarely used today, compared to more than 20 years ago. |

In addition to this, there are four flags at the bottom of the main box: `Stereo`, `Artificial Head`, `Compressed`, and `Dynamic PTY`.
<br>
<br>
The first indicates whether the broadcast program is in stereo, and the last indicates whether the PTY is likely to vary depending on the station's programming.
<br>
The other two have questionable usefulness nowadays and are even tending to disappear from some recent RDS encoders.
<br>
<br>
There are also four flags above the `ECC` and `LIC` fields: `ODA` / `RT+` / `EON` / `TMC`.
<br>
<br>
If the `ODA` flag (Open Data Applications) is active, it means that a secondary application is being used. To learn more, hover your mouse cursor over the flag, and information about the service will appear along with the group on which it is transmitted. The integrated `ODA` database of RDSExpert allows the identification of about 70 different codes.
<br>
<br>
The `RT+` flag indicates that the station is using the Radiotext+ function. You can view the transmitted information using the dedicated decoder located below.
<br>
The same applies to the `EON` (Enhanced Other Networks) and `TMC` (Traffic Message Channel) flags, which allow for the transmission of precise traffic informtion, including event locations, to compatible car tuners.
<br>
<br>
Finally, the `Reset Data` button allows you to reset all the data displayed by the decoder, and the `Underscores` button allows you to replace spaces with underscores for easier viewing. You can choose to display them on the PS (Programmable Speaker) or Radiotext only, or on both simultaneously.

# Information history and data export to text format

By clicking on `PS/PTY History`, you can view the history of the various PS messages sent by the station on the frequency you are tuned to.
<br>
This function is particularly useful if the PS is dynamic.
<br>
<br>
Since the PTY value is also dynamic on a few stations, this allows you to track any changes related to the Program Type data.
<br>
For practical and performance reasons, the display is limited to the last 200 entries.
<br>
<br>
By clicking on “Radiotext History,” you will have access to a history of the texts transmitted in the `RT A` and `RT B` fields, in the same way as the `PS/PTY history`.
<br>
The display is also limited to the last 200 entries in this case, for the same reasons mentioned above.
<br>
<br>
Clicking the `Export Data to Text` button allows you to retrieve most of the station's RDS data to save everything as an archive or to share it with anyone.
<br>
You can either copy and paste the information directly or download it in .txt format.

# Alternative Frequencies (AF)

This function allows receivers (mainly car tuners) to automatically switch to other frequencies of the same station, ensuring optimal reception for the listeners.
<br>
<br>
When the signal becomes weak and difficult to hear, the car tuner can switch to another frequency on the network, provided that it is in the list.
<br>
This is particularly useful when driving, allowing for seamless switching between the different transmitters used by the station.
<br>
<br>
RDSExpert is able to display these frequency lists, indicating the type of method used (A or B). The head of list ("Master" frequency) appears in a blue box as soon as it is decoded.
<br>
By default, the list is displayed as configured by the engineer. This means it may not always be in the correct order.
<br>
To automatically sort the frequencies and thus ignore the order configured by the engineer on the RDS encoder, you can click the `Frequency Sorting` button.
<br>
<br>
Method A is technically limited to 25 frequencies. Method B allows to transmit much more, in the form of multiple lists with different "master" frequencies. The display in the decoder varies depending on the method used, for these reasons.

# Radiotext+

The `Radiotext+` function enhances interactivity by displaying information sent on the Radiotext (`RT A` and `RT B`) separately.
<br>
<br>
For example, if a station displays the name of song it currently airs, Radiotext+ can retrieve the artist and song titles and display them separately.
<br>
This improves the display of this information on certain compatible car tuners.
<br>
<br>
This function is not limited to this type of information: 63 different tags exist (For example, "Website/URL" or "SMS: Studio").
<br>
All of these tags can be recognized by RDSExpert thanks to an integrated database, which displays the tag type, its content, and its identification number (From 1 to 63).
<br>
<br>
RDSExpert has a cache function for Radiotext+, meaning that the decoder memorizes all tags and their content and can display them even when they are not currently transmitted.
<br>
This is a handy way to ensure you don't miss a single one. In this case, the tag type is accompanied by the `CACHED` indicator, which disappears again as soon as the tag is transmitted again.
<br>
<br>
The `Radiotext+` section also includes a real-time display of the `Item Running` and `Item Toggle` bits usage.
<br>
If these bits are being sent, the display lights up green.

# Enhanced Other Networks (EON)

The `EON` function allows car tuners to monitor other stations, usually part of the same network as the one being listened to, in order to switch more efficiently to one of them when a traffic announcement is aired.
<br>
<br>
RDSExpert has the ability to display a list of stations present in the `EON` configuration of the station being listened to, along with their `PI` codes.
<br>
By clicking on one of the lines, you can see the `mapped frequencies` and the Method A `AF` (If this function is used).
<br>
<br>
The tool also allows you to view `Linkage` and `PTY` information, whether the `TP` and `TA` flags are enabled, and whether a `PIN` value is being transmitted.

# Groups Monitor

The `Groups Monitor` allows you to view the live transmission activity of the different RDS groups.
<br>
<br>
Click `Start` to begin scrolling through the different groups, along with percentage statistics that show whether a group is transmitted more frequently than others.
<br>
The percentage is accompanied by the number of packets per group, which can be easily compared to the total number of decoded packets.
<br>
<br>
If an `ODA` application is detected on group 3A, a message appears at the top of the `Groups Monitor` window with the service ID, its 4-character code, and the group to which this data is being sent.
<br>
RDSExpert has an official database of approximatively 70 different codes, allowing it to recognize different `ODA` applications based on the code sent by group 3A. The tool can also display the code of an application that is not recognized (If it is not present in the database).
<br>
<br>
Clicking the `Show Groups Content` button allows you to view the content transmitted on a particular group in binary and ASCII formats.
<br>
Select the group you wish to monitor from the list, you should see the rows scroll by. Only one group can be monitored at a time.
<br>
<br>
Clicking the `Show Hex Values` button displays the values ​​transmitted for up to four groups simultaneously, in hexadecimal format. To change the monitored group in each column, simply click on the header group and replace it with the desired group.
<br>
You can pause, reset, or stop the display at any time.
<br>
<br>
Here are some examples of groups commonly sent over RDS:
| Group | Utility / Function |
| --- | --- |
| 0A | The most common group: Transmits the `PI` code, `PS`, `PTY`, `AF` list... |
| 1A | Sends `ECC` (Extended Country Code) and `LIC` (Language Indication Code) information, which allows identification of the country from which the station broadcasts as well as the language in which its programs are broadcast. |
| 2A | Transmits `Radiotext`: Often used to display a slogan or the title of the song being aired by the station, as well as useful information for the listeners. |
| 3A | Sends the list of the `ODA` applications being used: Allows the receiver to identify which ODA applications are used by the station (The most common examples are `Radiotext+` and `TMC`), if the station uses any. |
| 4A | Clock Time (`CT`) : Transmits the date and time in order to synchronize the receivers clock, most often car tuners. This group is generally transmitted every 60 seconds, at the beginning of each minute. |
| 10A | `PTYN`: Equivalent to `PTY`, but in a completely customized way as previously indicated in this documentation. |
| 14A | `EON (Enhanced Other Networks)`: See the indications mentioned above in this documentation. |
| 15A | `Long PS`: Allows a longer PS to be displayed, up to 32 characters, than the standard sent on group 0A which only permits 8 characters. |

Groups 5A, 6A, 7A, 8A, 9A, 11A, 12A and 13A are free and generally used to transmit information related to Open Data Applications (`ODA`).
<br>
<br>
Less frequently, and depending on the station, these same groups may have a "B" variant (0B and 2B, for example).
<br>
Their characteristics are the same, and they can replace the widely used "A" variants.

# Traffic Message Channel (TMC)

This decoder was implemented on a purely experimental basis.
<br>
<br>
If the `TMC` service is available on the radio station being listened to, the `SERVICE DETECTED` indicator will light up. You can begin decoding the data by clicking the `START` button.
<br>
<br>
Although this technology is becoming increasingly deprecated and is being phased out in Europe, some countries still use it.
<br>
For example, as of December 10, 2025: The United Kingdom still sends this type of data through the Classic FM network, and Germany also sends this information on the ARD network stations.
<br>
<br>
The information displayed on the screen consists of the various traffic information events sent through the `TMC` service (e.g. Road closures, congestion, accident, etc.).
<br>
The decoder includes an update counter that increases each time a message is sent for the same event.
<br>
<br>
A raw location code is also displayed. It is not possible to know precisely where the event is located, as this would require access to a `TMC` database maintained by important companies, which is generally not freely available to the public.
<br>
<br>
The `TMC` decoder displays details about each event, such as `CC` and `LTN` codes, the type of `emergency`, the `nature` of the alert, its `duration`, etc.

# System Logs

As its name suggests, this section allows you to keep track of various events that occur while using the decoder, such as connection problems.
<br>
<br>
If you encounter an issue connecting to a server, these messages can help you find the cause.
