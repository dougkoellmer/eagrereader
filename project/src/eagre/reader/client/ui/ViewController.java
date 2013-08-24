package eagre.reader.client.ui;

import swarm.client.app.bhClientAppConfig;
import swarm.client.states.StateContainer_Base;
import swarm.client.ui.bhViewConfig;
import swarm.client.ui.bhViewController;
import swarm.client.ui.sm_view;
import swarm.client.ui.cell.bhVisualCellContainer;
import swarm.shared.statemachine.bhA_Action;

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
		
		bhVisualCellContainer cellContainer = sm_view.splitPanel.getCellContainer();
		cellContainer.getCellContainerInner().getElement().getStyle().setBackgroundColor("#9DA1CA");
	}
}
