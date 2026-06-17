# RDSExpert Changelog

### --- 17/06/2026 ---
- Add a real-time counter of the number of packets recorded on the "RECORD RAW DATA" button when this function is active.
- Added a "Time Error" indicator as a tooltip for the "UTC CT" field, allowing comparison of the time sent to group 4A with the user's computer time. This allows verification of whether group 4A's clock is ahead, behind, or correct.
- Added a timestamp to each line of RDS blocks in the "RAW DATA" recording files. This allows the time sent via the CT function (Group 4A) to be compared to the exact time on the user's computer at the time of recording.

### --- 31/05/2026 ---
- Added a confirmation dialog box when closing the tab, if a bandscan recording is in progress, to prevent accidental closures.
- Added a drag-and-drop function to the "Raw Data" file playback button to allow the user to more easily and quickly select a file to play.
- Added a graphical display of the RDS group distribution, both as a pie chart and horizontal bars. This allows the user to see the distribution of groups at a glance and identify those that are transmitted most and least. To access it, click the new button to the right of "Group Distribution Statistics".
- Added a shortcut to view the content of a group by clicking on it in the "Group Distribution Statistics".
- Added an indicator displaying the number of stations found in the EON list.
- Added display of all possible Radiotext codes (e.g. <0A>) in PDF exports.
- Added display of the <0D> code on the Long PS field on PDF exports.
- Added the ability to record multiple RDS consecutively using the "Record Raw Data" function. Afterward, the user will be able to download a ZIP archive containing all the recordings made during the bandscan session.
- Added the graphical representation (in pie chart form) of the RDS groups distribution in PDF exports.
- Added the name of the TMC service provider in the Group Monitor and TXT/PDF exports.
- Added the number of expected frequencies to the AF list, taking the "Number of AF" value from the list, in addition to the number of currently decoded frequencies. This allows the user to know how many AF frequencies are supposed to be transmitted in the list, ensuring that it is fully decoded. It can also allow the user to identify technical errors in the RDS encoding.
- Added the "REG" indicator for AF frequencies that have the regional variant indicator (Method B only).
- Fixed a PS display error which, in a very specific "corruputed PS" case, indicated the code <10> instead of dashes.
- Fixed a PS display error in PDF exports, which occurred when no PS was decoded ("--------").
- Fixed incomplete or non-functional Radiotext+ tags decoding for a specific RDS encoding case.
- Refinement of certain interface texts to improve the English translation.
- The "System Logs" section has been renamed "System & Connections Logs" and has received a minor graphical refinement.

### --- 14/05/2026 ---
- Added an optional feature (which can be enabled or disabled) to the export function: "Include Groups Sequence", which allows to save the sequence of the last 100 decoded groups in PDF and TXT exports.
- Optimized the BER counter so that the initial value is accurate. Previously, the counter might have displayed 0% and then suddenly 50%.
- Optimized the display of Radiotext in PDF exports so that no content is truncated, for example, when there are a large number of Radiotext codes.
- Optimized the Groups Monitor display so that decoding errors, caused by the websocket, are not shown during the first 3 seconds after a frequency change.

### --- 13/05/2026 ---
- Added display of the Radiotext code <00>.
- Added display of the <0D> code on the TDC history.
- By default, the PS field is now displayed as " -------- " and the dashes gradually disappear as the station's PS is decoded. This also makes it possible to determine if a PS is incorrectly encoded.
- Fixed an issue that caused spaces to appear at the beginning of TDC messages when the <0D> code was used at the end of those messages.
- Fixed an issue that prevented ECC and LIC values from being displayed when a specific encoding format was used for Group 1A.
- Fixed an issue that prevented the BER value from being displayed when reading RAW data recordings (it was always shown as 0%). The presence of undecodable groups is now taken into account.

### --- 15/03/2026 ---
- Added IH (In House Applications), TDC (Transparent Data Channels), RP (Radio Paging) and eRT (Enhanced Radiotext) indicators on the data and bandscan PDF exports.
- Added "Instant Playback" function for Raw Data playback. This allows you to view all the RDS data contained in a recording without having to wait for real-time decoding. You can still use real-time decoding by selecting "Normal Playback" displayed after clicking on the "Raw Data" playback button.

### --- 08/03/2026 ---
- Added <0D> indicator in the Enhanced Radiotext history.
- Added <0D> in the copied text for messages from the Enhanced Radiotext history.
- Fixed a bug in the Enhanced Radiotext decoder that prevented messages in Latin characters from being displayed after decoding a message in non-Latin characters.

### --- 06/03/2026 ---
- Fixed a bug that caused certain letters with accents to be displayed incorrectly in the Enhanced Radiotext history.
- Fixed a bug that caused letters with accents to be displayed incorrectly when decoding was in progress on the Long PS.
- Fixed a bug that stopped Raw Data recordings from playing when clicking the "Reset Data" button instead of resetting the RDS display.
- Fixed a display bug affecting non-Latin characters in the Enhanced Radiotext history.
- Improved clarity of the "Raw Data" progress bar when playing back a recording for better visibility.

### --- 05/03/2026 ---
- Added a tooltip displaying the time difference (Time Offset) on the "Local CT" field, relative to UTC time.
- Added channels display in the IH (In House Applications) history, from 0 to 31.
- Added channels display in the TDC (Transparent Data Channels) history, from 0 to 31.
- Added display of "non-standard" PIN data. Some stations incorrectly send PIN data with "0" as day value. Until now, the PIN data was not decoded in such situation.
- Added Enhanced Radiotext decoding, with eRT+ tags. This advanced Radiotext feature, which is rarely used, allows, among other things, the display of non-Latin characters (such as Arabic or Greek). The decoding history is available by clicking on the new "eRT" indicator when such data is detected (requires sending the ODA indication dedicated to this use on group 3A).
- Added Radio Paging decoding on group 7A. It can be accessed by clicking on the new "RP" indicator when data is detected. The decoder is capable of intelligently detecting the type of messages sent. It can distinguish between a numeric or alphanumeric message, for example.
- Added Raw Data recording. This allows to record all RDS groups during decoding and export them in ASCII format. This recording can then be played back on RDSExpert or any other tool that supports playback of ASCII format recordings.
- Added Raw Data playback. It allows to play recordings in ASCII format, in order to view RDS decoding as on a signal received in real time. Recordings from other tools (such as RDS Spy, for example) are supported.
- Added Slow Labelling Codes (SLC) indicators to the Groups Monitor. This information is sent on group 1A and indicates, for example, the presence of an Extended Country Code.

### --- 28/02/2026 ---
- Added a 3 seconds delay for the In House Applications and TDC detection, in order to prevent false identifications. The indicators could light up incorrectly if groups 5A/5B and 6A/6B were used for another purpose.
- Added a new value to the LIC list (Language codes): LIC 40 -> "Clean feed".
- Added LW/MW frequencies recognition in the Method A AF lists. When found, they are displayed in purple boxes.
- Added recognition of the version used by the user (HTTP or HTTPS) to ensure that the information window regarding the inability to use an HTTP server on the HTTPS interface is not displayed when the HTTP version is used. A button has also been added to the HTTPS version modal, allowing immediate connection to the HTTP server via the version hosted by @Bkram (Opens in a new tab).
- Disabled Radiotext+ decoding if the RT+ ODA points to a B group, since it is technically impossible to encode Radiotext+ outside of A groups.
- Fixed a bug in the Long PS field that caused incorrect display during progressive decoding of Cyrillic characters until decoding was complete.
- Fixed a bug that prevented Radiotext+ detection and decoding on groups 5A/5B and 6A/6B, following the addition of TDC and In House Applications data decoding.
- In the plugin version, the "IH" indicator is now located between "TMC" and "TDC" to avoid confusion between these two indicators.
- The display of RDS groups content has been revised in the “Groups Monitor” section to make it clearer and more detailed.

### --- 27/02/2026 ---
- Corrected and refined some group descriptions.

### --- 25/02/2026 ---
- Added In-House Applications decoding. There is now an "IH" indicator: It lights up when such data is detected. To click on it will allow the user to view the data sent on groups 6A and 6B. An intelligent mechanism verifies whether groups 6A and 6B are actually used for sending In-House data or for an ODA.
- Added TDC (Transparent Data Channel) decoding. There is now a "TDC" indicator: It lights up when such data is detected. To click on it will allow the user to view the data sent on groups 5A and 5B. An intelligent mechanism verifies whether groups 5A and 5B are actually used for sending TDC data or for an ODA.
- Fixed special characters display in the groups monitor (More precisely in the Groups Content viewer). Some letters specific to certain languages were incorrectly displayed.

### --- 22/02/2026 ---
- Added TMC Map feature thanks to the contribution of Sjef Verhoeven (@PE5PVB). A major thanks to him for his work!

### --- 17/02/2026 ---
- Added "EWS ID" into the description of group 1A in the Groups Monitor and the PDF + TXT exports.
- Added identification for factory PI 3180 (PCS Electronics).
- Added new factory PI codes for PCS Electronics: A1B8 and C080.
  
### --- 16/02/2026 ---
- Added EWS (Emergency Warning System) indicator. The new box lights up if the station sends an EWS indication on group 1A, and the 2-character ID appears. Alerts details are not supported and displayed, the official documentation on the subject is, unfortunately, relatively low.
- Added factory PI codes detection and identification. When a factory code is detected, the "PI" field becomes red. Details about who uses this code are visible as a tooltip when the user puts the mouse cursor on the PI field. The values in database are based on RDS encoders manuals, personal knowledge and kind contributions from people who are into radio engineering.
- Added frequencies counter for AF Method A.
- Added PI to Callsign converter (for USA) as a tooltip. It appears when the user puts the mouse cursor on a PI value, if valid for such conversion.
- PS underscores reduced for stations using 2B group for the Radiotext, since 2B only allows 32 characters text. When underscores are enabled on RT, they will stop at the 32nd character. The underscores rule remains the same for stations using 2A for RT.
- Underscores are now removed on Long PS and RT once a <0D> code is detected. They are still visible on the "Progressive underscores on RT" mode.
- Underscores are now removed on Long PS when the decoded RDS doesn't include this function (via group 15A).

### --- 15/02/2026 ---
- TMC decoder: Fixed a bug in the Provider Name display.

### --- 14/02/2026 ---
- Added a tooltip to each RT line to indicate the maximum number of characters that can be sent depending on the group used, 2A or 2B ("32 char." / "64 char.")
- Added an "information" icon. Clicking it will redirect the user to the decoder's documentation on GitHub (Wiki) via a new tab.
- Added EID and Channel info in the ODA's section of the PDF/TXT exports when the DAB Cross-Referencing ODA is detected.
- Added Radiotext technical codes (e.g. <0D>) to the Radiotext history on the interface and in the TXT export.
- Added user's preferences storage in the web browser (using localStorage). For example, if the user enables underscores on PS/RT, they will appear at the next session.
- Bandscan export: Added a delay of 2 seconds before an RDS is considered as "storable" to prevent RDS data from being logged for a previous frequency.
- Detailed data/Bandscan export: Added empty Radiotext recognition. If a station doesn't send text but a technical code such as <0D>, the RT will be displayed as is.
- Empty PS messages are now detected and stored in the PS history.
- Fixed missing ECC recognition for Finland (6xxx > E1).
- TMC decoder: Added provider name, decoded from Group 8A.

### --- 11/02/2026 ---
- Added TP, TA and PTY values to the PDF's EON section, in addition to the AF and Mapped Frequencies that were already included.
- Added an error message if the webserver API cannot be contacted when starting a bandscan.
- Radiotext codes (e.g. <0D>) are now displayed in the PDF exports.

### --- 01/02/2026 ---
- Bandscan/Detailed data export: Added dBf to dBuV conversion in the export-preview modal.
- Bandscan/Detailed data export: Added dynamic PS messages display in the main PS field, limited to 14 messages.
- Bandscan/Detailed data export: Added purple color to the PS field for stations using a dynamic PS in the stations/signals summary.
- Calls to the webservers API have been strengthened. New calls are attempted every 5 seconds if the first one is unsuccessful.
- Improved the PS history to reduce decoding errors.

### --- 29/01/2026 ---
- Added bandscan and detailed reports function with TXT and PDF export.

### --- 13/01/2026 ---
- Added Ensemble ID and Channel info in the groups monitor when the DAB Cross-Referencing ODA is detected.
- Added Flag A / Flag B display for the PTYN field as a tooltip.
- Added new underscores option: "Progressive underscores on RT".
- The values in the PS/PTY/PTYN history are now separated.

### --- 04/01/2026 ---
- Added a function to show spaces as underscores in the PS history.
- Improved data export to text. Output is now smoother and includes more information.
- Improved the mapped frequencies display in the EON section. 10 frequencies can be displayed now, instead of 4.
- Removed RDS/RBDS button. Both PTY versions are now displayed in the field, separated by a vertical line.

### --- 03/01/2026 ---
- Changed the BER indicator behavior: It will now appear after 3 seconds to prevent the display of incorrect values, waiting for the RDS websocket to stabilize itself.

### --- 31/12/2025 ---
- Added automatic RDS data reset on frequency change.
- Fixed an issue that caused the RT indicator not to be active when RT was being sent, but without text being displayed on screen.
- Fixed some errors in the characters table.

### --- 29/12/2025 ---
- Integration plugin released for the TEF webservers (Check the "RDSExpert-Plugin" repository for more details).
- The interface has been reviewed to allow usage on smartphones, but exclusively in landscape format.

### --- 20/12/2025 ---
- Added the possibility to connect to another server without clicking "Disconnect", thanks to the Enter key.
- Added automatic connection to a webserver by using the "?url=" parameter.
- Improved characters compatibility for the PTYN and Long PS fields, to resolve some decoding errors.
- More improvements made to the TMC decoder.

### --- 14/12/2025 ---
- Added "Pause" and "Copy" buttons to the PS/PTY/PTYN and Radiotext History functions.
- Added recognition of more than 1500 events messages to the TMC decoder.
- Groups descriptions added to the groups monitor as tooltips.

### --- 11/12/2025 ---
- Added ECC and LIC recognition as tooltips.

### --- 08/12/2025 ---
- Added ODA flag. Details are now visible when the mouse cursor is placed on the flag, thanks to a tooltip.
- Improvements made to the Radiotext+ decoding.
- "Pause" button added to the groups monitor.

### --- 07/12/2025 ---
- Fixed some errors in the RT+ tags decoding.
- Improved special characters decoding.
- Improvements made to the group distribution statistics in order to ignore incorrect packets.

### --- 06/12/2025 ---
Official beginning of the project.


































