# RDSExpert | Introduction
RDSExpert is an advanced RDS (Radio Data System) decoder for [FM-DX webservers](https://servers.fmdx.org/), based on HTML and TypeScript.
<br>
It is also designed for RBDS (RDS variant for North America).


![affichage-principal-rdsexpert-rsz](https://github.com/user-attachments/assets/c9a183f1-1b2c-4249-a6ce-ad8e40bf5bca)
- - -
-> [You can access the interface by clicking on this link.](https://lucasgallone.github.io/RDSExpert)
<br>
-> Otherwise, you can copy and paste the following URL: `https://lucasgallone.github.io/RDSExpert/`
<br>
-> You can also integrate RDSExpert directly into your webserver as a plugin! Instructions are provided below.
- - -
This tool will be of particular interest to radio engineers and anyone with an interest in radio engineering. Its purpose is to allow in-depth analysis of the RDS data carried by FM signals, which webservers cannot completely display for obvious usability reasons.
<br>
<br>
<b>It is important to note that the RDS decoding is less sensitive than that used natively by FM-DX webservers.</b> Therefore, an "acceptable" signal is necessary for accurate decoding. While it would be technically possible to increase the decoding sensitivity, this would increase the risk of displaying erroneous data, making the tool less reliable. For DX receptions and very weak signals, it is therefore strongly recommended to use the integrated decoder of the FM-DX webservers.
<br>
<br>
<b>Initially, this tool only works with HTTPS servers due to web browsers restrictions.
<br>
Another version hosted by [@Bkram](https://github.com/bkram/) exists, and you will be linked to it if you indicate an HTTP webserver URL on the interface.</b>
<br>
Follow the on-screen instructions after indicating it, and you'll be able to use the tool that way.
- - -
<b>📱 RDSExpert is also available as a mobile version. However, you must rotate your smartphone to landscape mode to use the interface.</b>
- - -
<b>⚠️ Important note to Google Chrome users: Since April 2026, connecting to HTTP servers using a local address (e.g. 192.168.1.100) is no longer possible by default. You must disable the "Local Network Access Checks" feature in your web browser to bypass this block implemented by Google, otherwise the connection will fail.
<br>
<br>
-> To do this, enter `chrome://flags/#local-network-access-check` in the URL bar, then disable the relevant option.</b>
<br>
<br>
If you are concerned about the potential risks this may cause, it is best to use a different web browser such as Mozilla Firefox.
## Data that can be decoded
• General features for the station identification: <b>PI code</b>, <b>PS</b>, <b>TP/TA flags</b> (Traffic Program - Traffic Announcement) and <b>Music/Speech switch</b>.
<br>
<br>
• <b>Radiotext messages on Lines A and B</b>, with recognition of the maximal number of characters (64 if sent on 2A, 32 is sent on 2B).
<br>
<br>
• <b>PTY (Program Type)</b>.
<br>
<br>
• <b>PTYN (Program Type Name)</b> with A/B flag detection.
<br>
<br>
• <b>AF decoding for Methods A and B</b>, with the ability to sort decoded frequencies.
<br>
<br>
• <b>Long PS</b> (from Group 15A).
<br>
<br>
• <b>Clock Time</b> (Local and UTC values).
<br>
<br>
• <b>Enhanced Other Networks (EON)</b>.
<br>
<br>
• <b>Extended Country and Language Identification codes (ECC/LIC)</b> with country and language interpretation in tooltips.
<br>
<br>
• <b>EWS channel indication</b> (Emergency Warning System).
<br>
<br>
• <b>PIN data.</b>
<br>
<br>
• <b>ODA (Open Data Applications) presence indicator</b> with application recognition, using a database.
<br>
<br>
• <b>Decoder Identification flags</b>: Stereo, Artificial Head, Compressed, and Dynamic PTY.
<br>
<br>
• <b>Radiotext+ (RT+)</b> with tags identification and interpretation.
<br>
<br>
• <b>Traffic Message Channel (TMC)</b> with interpretation of the decoded messages, thanks to a database containing over 1500 event codes.
<br>
<br>
• <b>In House Applications (IH) data</b>, from channel 0 to 31.
<br>
<br>
• <b>Transparent Data Channels (TDC)</b>, from channel 0 to 31.
<br>
<br>
• <b>Standard Radio Paging (RP)</b>, with intelligent detection of the type of messages transmitted (Alphanumeric, Numeric, etc.) and decoding adapted to the messages type.
<br>
<br>
• <b>Enhanced Radiotext (eRT) with eRT+ tags</b> identification and interpretation.
<br>
<br>
• <b>DAB Cross-Referencing</b>, with the display of the listed Ensemble ID and its channel (In the "Groups Monitor").
## Features
• <b>Raw RDS data recording</b>, to make complete recordings of all decoded groups, in ASCII format. 
<br>
<br>
• <b>Raw RDS data playback</b>, to play recordings with real-time or instant decoding, even many years later. All ASCII format recordings are supported, even from other RDS decoders.
<br>
<br>
• <b>Direct data export</b>, in PDF and TXT format.
<br>
<br>
• <b>Bandscan recording</b>, with all RDS data from the scanned stations, a received signals summary including the transmitters cities and powers (ERP), as well as the reception levels in dBf/dBuV. Exportable in PDF and TXT format.
<br>
<br>
• <b>Groups Monitor</b>, in order to explore and make a deep analysis of all the different groups transmitted on the decoded RDS. 
<br>
<br>
• <b>Map for TMC (Traffic Message Channel)</b>, to display the location of decoded events. Only works for certain countries, depending on location data availability.
<br>
<br>
• <b>PI to Callsign converter</b>, as a tooltip on the PI field, for the stations from the US.
<br>
<br>
• <b>Detection of the factory PI codes with manufacturers display</b>, thanks to a database.
<br>
<br>
• <b>BER (Bit Error Rate) indicator</b>, in order to determine the RDS decoding quality.
## Special thanks to...
• [@mrwish7](https://github.com/mrwish7/) for the initial implementation of the RDS WebSocket decoding (thanks to his [ws2tcp](https://github.com/mrwish7/ws2tcp) repository), without which creating this tool would have been more complicated. 
<br>
<br>
• [@Bkram](https://github.com/bkram) for hosting the HTTP-compatible version on his server as mentioned above.
<br>
<br>
• [@PE5PVB (Sjef Verhoeven)](https://github.com/PE5PVB) for his work on adding the TMC Map feature.
<br>
<br>
• All those who submitted suggestions, ideas, bug reports and who took the time to test this tool with different types of RDS encoders.
# Integrate RDSExpert into your FM-DX webserver as a plugin!
If you want to use RDSExpert directly on your FM-DX webserver, this plugin is made for you!
<br>
<br>
The integrated interface allows you to use the decoder in a compact and direct way thanks to a floating window on the server.
<br>
No need to open a new tab in your web browser and enter your server URL every time. Everything is automated!
<br>
<br>
To download the plugin and install it on your webserver, [follow the instructions by clicking here.](https://github.com/LucasGallone/RDSExpert-Plugin)
<br>
Or copy-paste the following link: `https://github.com/LucasGallone/RDSExpert-Plugin`
# Getting started | Help documentation
Learn how to use RDSExpert and find out more about the various functions offered by the decoder:
<br>
[Go to the Wiki section by clicking here.](https://github.com/LucasGallone/RDSExpert/wiki/)
# License
This project is licensed under the GNU General Public License (GPL) v3.0.
<br>
Please refer to the `LICENSE` file for more details.
