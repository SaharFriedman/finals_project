const image = require("../assets/zibi.jpg")
const DailyTip = ({header, subheader, content, img_ref}) =>(
    <div className="contentContainer">
        <div className="dailyTipContainer">
            <div className="container-fluid dailyTipBackgroundContainer">
                <img src={image} alt="daily tip" loading="lazy"/> {/* remember to change this to img_ref later*/}
                <div className="dailyTipOverlayContainer">
                    <div className="dailyTipHeaderContainer">
                        Daily Tip:&nbsp;
                        {header}
                    </div>
                    <div className="dailyTipSubheaderContainer">
                        {subheader}
                    </div>
                    <div className="dailyTipContentContainer">
                        {content}
                    </div>
                </div>
            </div>
    
        </div>
    </div>
)

export default DailyTip;