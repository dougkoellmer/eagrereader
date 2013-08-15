package eagre.reader.client.ui;

import b33hive.client.app.bhClientAppConfig;
import b33hive.client.states.StateContainer_Base;
import b33hive.client.ui.bhViewConfig;
import b33hive.client.ui.bhViewController;
import b33hive.client.ui.bh_view;
import b33hive.client.ui.cell.bhVisualCellContainer;
import b33hive.shared.statemachine.bhA_Action;

public class ViewController extends bhViewController
{
	public ViewController(bhViewConfig config, bhClientAppConfig appConfig)
	{
		super(config, appConfig);
	}

	@Override
	protected void startUpCoreUI()
	{
		bhA_Action.perform(StateContainer_Base.HideSupplementState.class);
		
		super.startUpCoreUI();
		
		bhVisualCellContainer cellContainer = bh_view.splitPanel.getCellContainer();
		cellContainer.getCellContainerInner().getElement().getStyle().setBackgroundColor("#9DA1CA");
	}
}
